/**
 * Tests for concurrent Y.Text editing via applyYTextDiff.
 *
 * applyYTextDiff computes the minimal edit (common prefix/suffix) so Yjs
 * knows exactly which characters changed and can merge concurrent edits
 * in non-overlapping regions cleanly.
 */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { applyYTextDiff } from '@/hooks/useYText';

/** Exchange all pending updates between two docs so they converge. */
function syncDocs(docA: Y.Doc, docB: Y.Doc) {
  const stateA = Y.encodeStateVector(docA);
  const stateB = Y.encodeStateVector(docB);
  const diffAtoB = Y.encodeStateAsUpdate(docA, stateB);
  const diffBtoA = Y.encodeStateAsUpdate(docB, stateA);
  Y.applyUpdate(docB, diffAtoB);
  Y.applyUpdate(docA, diffBtoA);
}

describe('concurrent Y.Text editing', () => {
  it('concurrent appends preserve base text once', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const textA = docA.getText('note');
    textA.insert(0, 'shared note');
    syncDocs(docA, docB);
    const textB = docB.getText('note');

    applyYTextDiff(textA, 'shared note', 'shared note - reviewed by Alice');
    applyYTextDiff(textB, 'shared note', 'shared note - reviewed by Bob');
    syncDocs(docA, docB);

    const result = textA.toString();
    expect(textA.toString()).toBe(textB.toString());

    const baseOccurrences = result.split('shared note').length - 1;
    expect(baseOccurrences).toBe(1);
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
  });

  it('non-overlapping edits merge cleanly', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const textA = docA.getText('note');
    textA.insert(0, 'the cat sat');
    syncDocs(docA, docB);
    const textB = docB.getText('note');

    applyYTextDiff(textA, 'the cat sat', 'the dog sat');
    applyYTextDiff(textB, 'the cat sat', 'the cat ran');
    syncDocs(docA, docB);

    expect(textA.toString()).toBe(textB.toString());
    expect(textA.toString()).toBe('the dog ran');
  });

  it('deleting leading text does not duplicate the remainder', () => {
    // Regression: deleting the first word leaves newValue as a pure suffix of
    // oldValue, so prefixLen=0 and suffixLen=newValue.length. The end index
    // (newValue.length - suffixLen) is then 0, which must yield an empty insert
    // - not the whole string. A `|| undefined` here previously re-inserted the
    // entire remaining text, duplicating the field.
    const doc = new Y.Doc();
    const text = doc.getText('note');
    const pasted = 'Allocation was concealed and the risk of bias is low overall.';
    text.insert(0, pasted);

    const corrected = pasted.replace('Allocation ', '');
    applyYTextDiff(text, text.toString(), corrected);

    expect(text.toString()).toBe(corrected);
    expect(text.toString().length).toBe(corrected.length);
  });

  it('deleting all leading chars down to a shared suffix is not duplicated', () => {
    const doc = new Y.Doc();
    const text = doc.getText('note');
    text.insert(0, 'XYZ tail content here');
    applyYTextDiff(text, text.toString(), 'tail content here');
    expect(text.toString()).toBe('tail content here');
  });

  it('concurrent appends at the end both survive', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const textA = docA.getText('note');
    textA.insert(0, 'base');
    syncDocs(docA, docB);
    const textB = docB.getText('note');

    applyYTextDiff(textA, 'base', 'base alpha');
    applyYTextDiff(textB, 'base', 'base beta');
    syncDocs(docA, docB);

    const result = textA.toString();
    expect(textA.toString()).toBe(textB.toString());
    expect(result.split('base').length - 1).toBe(1);
    expect(result).toContain('alpha');
    expect(result).toContain('beta');
  });
});
