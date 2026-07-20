/**
 * Regression tests for concurrent first-writes to shared containers.
 *
 * Several ops modules used to lazily create their container Y.Map on first
 * write (study.annotations, study.pdfs, study.reconciliations, meta.outcomes).
 * When two clients performed their first write concurrently (live editing or
 * one client offline), each created its OWN container Y.Map; Yjs kept exactly
 * one, and all entries in the losing container were permanently lost.
 *
 * Fixed by pre-creating containers with their parent (createStudy,
 * createChecklist, and the server-side ensureDocContainers migration for
 * meta.outcomes and pre-existing docs) and by storing reconciliation progress
 * as flat keys instead of a nested map per outcome.
 *
 * These tests simulate two real clients with two Y.Docs and explicit update
 * exchange, using the actual production ops modules.
 */

import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';

// studies.ts imports server-only modules for project rename; stub them so the
// real createStudy can run under jsdom.
vi.mock('@/project/ConnectionPool', () => ({ connectionPool: {} }));
vi.mock('@/lib/queryClient', () => ({ queryClient: {} }));
vi.mock('@/server/functions/org-projects.functions', () => ({ updateProject: vi.fn() }));

import { createAnnotationOperations } from '@/primitives/useProject/annotations';
import { createOutcomeOperations } from '@/primitives/useProject/outcomes';
import { createReconciliationOperations } from '@/primitives/useProject/reconciliation';
import { createPdfOperations } from '@/primitives/useProject/pdfs';
import { createStudyOperations } from '@/primitives/useProject/studies';

/** Exchange all pending updates between two docs so they converge. */
function syncDocs(docA: Y.Doc, docB: Y.Doc) {
  const stateA = Y.encodeStateVector(docA);
  const stateB = Y.encodeStateVector(docB);
  const diffAtoB = Y.encodeStateAsUpdate(docA, stateB);
  const diffBtoA = Y.encodeStateAsUpdate(docB, stateA);
  Y.applyUpdate(docB, diffAtoB);
  Y.applyUpdate(docA, diffBtoA);
}

/** Creates a study through the real ops so containers are pre-created. */
function addStudy(doc: Y.Doc): string {
  const ops = createStudyOperations('p1', () => doc, () => true);
  const studyId = ops.createStudy('Study 1');
  if (!studyId) throw new Error('createStudy failed');
  return studyId;
}

/**
 * Mirrors the server-side ensureDocContainers guarantee: meta.outcomes exists
 * before any client makes its first write.
 */
function seedMetaOutcomes(doc: Y.Doc) {
  doc.getMap('meta').set('outcomes', new Y.Map());
}

describe('concurrent first-write to lazily created containers', () => {
  it('annotations from both reviewers survive concurrent first annotation on a study', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const s1 = addStudy(docA);
    syncDocs(docA, docB);

    const opsA = createAnnotationOperations('p1', () => docA);
    const opsB = createAnnotationOperations('p1', () => docB);

    // Reviewer Alice and reviewer Bob each add their first annotation to the
    // same study while the other's update has not arrived yet (live race or
    // offline editing). Each annotates their own checklist.
    const idA = opsA.addAnnotation(
      s1,
      'pdf-1',
      'cl-alice',
      { type: 'highlight', pageIndex: 0 },
      'alice',
    );
    const idB = opsB.addAnnotation(
      s1,
      'pdf-1',
      'cl-bob',
      { type: 'highlight', pageIndex: 1 },
      'bob',
    );
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();

    syncDocs(docA, docB);

    // Docs converge...
    expect(docA.getMap('reviews').toJSON()).toEqual(docB.getMap('reviews').toJSON());

    // ...and BOTH reviewers' annotations must still exist on both clients.
    const allA = opsA.getAllAnnotationsForPdf(s1, 'pdf-1');
    const allB = opsB.getAllAnnotationsForPdf(s1, 'pdf-1');
    expect(Object.keys(allA).sort()).toEqual(['cl-alice', 'cl-bob']);
    expect(Object.keys(allB).sort()).toEqual(['cl-alice', 'cl-bob']);
  });

  it('outcomes created concurrently by two members both survive', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    seedMetaOutcomes(docA);
    syncDocs(docA, docB);

    const opsA = createOutcomeOperations('p1', () => docA);
    const opsB = createOutcomeOperations('p1', () => docB);

    // Two members each create the project's first outcome concurrently.
    const idA = opsA.createOutcome('Mortality', 'alice');
    const idB = opsB.createOutcome('Quality of life', 'bob');
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();

    syncDocs(docA, docB);

    const namesA = opsA
      .getOutcomes()
      .map(o => o.name)
      .sort();
    const namesB = opsB
      .getOutcomes()
      .map(o => o.name)
      .sort();
    expect(namesA).toEqual(['Mortality', 'Quality of life']);
    expect(namesB).toEqual(['Mortality', 'Quality of life']);
  });

  it('reconciliation progress for two outcomes saved concurrently both survive', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const s1 = addStudy(docA);
    syncDocs(docA, docB);

    const opsA = createReconciliationOperations('p1', () => docA);
    const opsB = createReconciliationOperations('p1', () => docB);

    // Both reviewers open reconciliation for the same study at the same time,
    // for different outcomes (first reconciliation activity on this study).
    opsA.saveReconciliationProgress(s1, 'outcome-1', 'ROB2', {
      checklist1Id: 'c1',
      checklist2Id: 'c2',
    });
    opsB.saveReconciliationProgress(s1, 'outcome-2', 'ROB2', {
      checklist1Id: 'c3',
      checklist2Id: 'c4',
    });

    syncDocs(docA, docB);

    const allA = opsA.getAllReconciliationProgress(s1);
    const allB = opsB.getAllReconciliationProgress(s1);
    expect(allA.map(r => r.outcomeId).sort()).toEqual(['outcome-1', 'outcome-2']);
    expect(allB.map(r => r.outcomeId).sort()).toEqual(['outcome-1', 'outcome-2']);
  });

  it('PDFs added concurrently by two members both survive', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const s1 = addStudy(docA);
    syncDocs(docA, docB);

    const opsA = createPdfOperations('p1', () => docA);
    const opsB = createPdfOperations('p1', () => docB);

    // Two members each upload the first PDF to the same study concurrently.
    const idA = opsA.addPdfToStudy(s1, {
      key: 'r2-key-a',
      fileName: 'alice.pdf',
      size: 100,
      uploadedBy: 'alice',
    });
    const idB = opsB.addPdfToStudy(s1, {
      key: 'r2-key-b',
      fileName: 'bob.pdf',
      size: 200,
      uploadedBy: 'bob',
    });
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();

    syncDocs(docA, docB);

    const readFileNames = (doc: Y.Doc) => {
      const study = doc.getMap('reviews').get(s1) as Y.Map<unknown>;
      const pdfs = study.get('pdfs') as Y.Map<unknown>;
      const names: string[] = [];
      for (const [, pdf] of pdfs.entries()) {
        names.push((pdf as Y.Map<unknown>).get('fileName') as string);
      }
      return names.sort();
    };

    expect(readFileNames(docA)).toEqual(['alice.pdf', 'bob.pdf']);
    expect(readFileNames(docB)).toEqual(['alice.pdf', 'bob.pdf']);
  });
});
