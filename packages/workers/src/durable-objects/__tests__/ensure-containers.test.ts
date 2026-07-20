import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { ensureDocContainers } from '../ensure-containers';

function addLegacyStudy(doc: Y.Doc, studyId: string, checklistIds: string[] = []) {
  const study = new Y.Map();
  study.set('name', 'Legacy study');
  const checklists = new Y.Map();
  for (const id of checklistIds) {
    checklists.set(id, new Y.Map());
  }
  study.set('checklists', checklists);
  doc.getMap('reviews').set(studyId, study);
}

describe('ensureDocContainers', () => {
  it('backfills missing containers on legacy studies and meta', () => {
    const doc = new Y.Doc();
    addLegacyStudy(doc, 's1', ['cl-1', 'cl-2']);

    const changed = ensureDocContainers(doc);
    expect(changed).toBe(true);

    const study = doc.getMap('reviews').get('s1') as Y.Map<unknown>;
    expect(study.get('annotations')).toBeInstanceOf(Y.Map);
    expect(study.get('pdfs')).toBeInstanceOf(Y.Map);
    expect(study.get('reconciliations')).toBeInstanceOf(Y.Map);
    const annotations = study.get('annotations') as Y.Map<unknown>;
    expect(annotations.get('cl-1')).toBeInstanceOf(Y.Map);
    expect(annotations.get('cl-2')).toBeInstanceOf(Y.Map);
    expect(doc.getMap('meta').get('outcomes')).toBeInstanceOf(Y.Map);
  });

  it('generates no update when the doc is already migrated', () => {
    const doc = new Y.Doc();
    addLegacyStudy(doc, 's1', ['cl-1']);
    ensureDocContainers(doc);

    let updates = 0;
    doc.on('update', () => {
      updates += 1;
    });
    const changed = ensureDocContainers(doc);
    expect(changed).toBe(false);
    expect(updates).toBe(0);
  });

  it('preserves existing container contents', () => {
    const doc = new Y.Doc();
    addLegacyStudy(doc, 's1');
    const study = doc.getMap('reviews').get('s1') as Y.Map<unknown>;
    const pdfs = new Y.Map();
    const pdf = new Y.Map();
    pdf.set('fileName', 'kept.pdf');
    pdfs.set('pdf-1', pdf);
    study.set('pdfs', pdfs);

    ensureDocContainers(doc);

    const pdfsAfter = study.get('pdfs') as Y.Map<unknown>;
    expect((pdfsAfter.get('pdf-1') as Y.Map<unknown>).get('fileName')).toBe('kept.pdf');
  });
});
