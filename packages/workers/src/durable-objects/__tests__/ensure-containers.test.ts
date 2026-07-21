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

  // Deploy-window skew: a client with an unsynced offline backlog lazily
  // created a container (with content) before ever seeing the server's
  // backfill. The two container creations are concurrent, so Yjs keeps exactly
  // one; the migration must be the one that loses. This test pins the Yjs
  // conflict direction the reserved low migration clientID relies on -- if a
  // Yjs upgrade changes the resolution order, this fails instead of silently
  // discarding user data.
  it('loses container conflicts against a concurrent client backlog with content', () => {
    const base = new Y.Doc();
    addLegacyStudy(base, 's1', ['cl-1']);
    const baseState = Y.encodeStateAsUpdate(base);

    // Server loads the legacy doc and migrates.
    const serverDoc = new Y.Doc();
    Y.applyUpdate(serverDoc, baseState);
    ensureDocContainers(serverDoc);

    // Concurrently, an offline client running lazy-creation code makes its
    // first annotation: creates study.annotations, the checklist sub-map, and
    // the annotation itself, never having seen the migration update.
    const clientDoc = new Y.Doc();
    Y.applyUpdate(clientDoc, baseState);
    const clientStudy = clientDoc.getMap('reviews').get('s1') as Y.Map<unknown>;
    const clientAnnotations = new Y.Map();
    const checklistAnnotations = new Y.Map();
    const annotation = new Y.Map();
    annotation.set('type', 'highlight');
    checklistAnnotations.set('ann-1', annotation);
    clientAnnotations.set('cl-1', checklistAnnotations);
    clientStudy.set('annotations', clientAnnotations);

    // Client reconnects: both sides exchange their pending updates.
    Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(clientDoc, Y.encodeStateVector(serverDoc)));
    Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(clientDoc)));

    for (const doc of [serverDoc, clientDoc]) {
      const study = doc.getMap('reviews').get('s1') as Y.Map<unknown>;
      const annotations = study.get('annotations') as Y.Map<unknown>;
      const forChecklist = annotations.get('cl-1') as Y.Map<unknown>;
      expect(forChecklist.has('ann-1')).toBe(true);
      expect((forChecklist.get('ann-1') as Y.Map<unknown>).get('type')).toBe('highlight');
    }
  });

  it('restores the doc clientID after migrating', () => {
    const doc = new Y.Doc();
    addLegacyStudy(doc, 's1');
    const originalClientID = doc.clientID;

    ensureDocContainers(doc);

    expect(doc.clientID).toBe(originalClientID);
  });
});
