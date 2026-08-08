/**
 * Cutover step 0: the formatVersion 2 migration export.
 *
 * The sync-engine transformer refuses v1 exports because they silently drop
 * outcomeId, annotations, reconciliations, and pdf tag/citation metadata.
 * These tests pin the v2 shape against a real ProjectDoc, including the two
 * pdf keying eras that coexist in production docs (web writes key by pdfId
 * and carry an `id` field; the legacy syncPdf path keys by fileName and has
 * none — the export must not fabricate an id from the map key, since a
 * fileName can repeat across studies).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import * as Y from 'yjs';
import { clearProjectDOs } from '../../__tests__/helpers.js';
import type { ProjectDoc } from '../ProjectDoc.js';

describe('devExport (formatVersion 2)', () => {
  const projectId = 'migration-export-test';

  beforeEach(async () => {
    await clearProjectDOs([projectId]);
  });

  function getStub() {
    const id = env.PROJECT_DOC.idFromName(`project:${projectId}`);
    return env.PROJECT_DOC.get(id);
  }

  it('exports the fields the v1 exporter dropped, across both pdf keying eras', async () => {
    const stub = getStub();

    // Legacy-era pdf: syncPdf keys the pdfs map by fileName, no id/tag.
    await stub.syncPdf({
      action: 'add',
      studyId: 'study-1',
      studyName: 'Study 1',
      pdf: {
        key: 'r2-key-legacy',
        fileName: 'paper.pdf',
        size: 1024,
        uploadedBy: 'user-1',
        uploadedAt: new Date().toISOString(),
      },
    });

    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      const doc = (instance as unknown as { doc: Y.Doc }).doc;
      doc.transact(() => {
        const meta = doc.getMap('meta');
        meta.set('name', 'Migration Export');
        // outcomes is a Y.Map keyed by outcomeId (createOutcome in
        // useProject/outcomes.ts) — the transformer's schema expects a record.
        const outcomes = new Y.Map<unknown>();
        const outcome = new Y.Map<unknown>();
        outcome.set('name', 'Mortality');
        outcome.set('createdAt', 1700000000000);
        outcome.set('createdBy', 'user-1');
        outcomes.set('outcome-1', outcome);
        meta.set('outcomes', outcomes);

        const study = doc.getMap('reviews').get('study-1') as Y.Map<unknown>;
        study.set('reviewer1', 'user-1');

        // Checklist with the fields v1 dropped: outcomeId, reviewerName —
        // and a Y.Text answer that must serialize to a plain string.
        const checklists = study.get('checklists') as Y.Map<unknown>;
        const checklist = new Y.Map<unknown>();
        checklist.set('type', 'ROB2');
        checklist.set('outcomeId', 'outcome-1');
        checklist.set('reviewerName', 'Ada');
        checklist.set('status', 'in_progress');
        const answers = new Y.Map<unknown>();
        answers.set('d1_1', 'Y');
        const comment = new Y.Text();
        comment.insert(0, 'free text');
        answers.set('d1_1.comment', comment);
        checklist.set('answers', answers);
        checklists.set('cl-1', checklist);

        // Web-era pdf: keyed by pdfId, carries id/tag/citation metadata.
        const pdfs = study.get('pdfs') as Y.Map<unknown>;
        const pdf = new Y.Map<unknown>();
        pdf.set('id', 'pdf-uuid-1');
        pdf.set('key', 'r2-key-web');
        pdf.set('fileName', 'web.pdf');
        pdf.set('size', 2048);
        pdf.set('tag', 'primary');
        pdf.set('title', 'A Title');
        pdfs.set('pdf-uuid-1', pdf);

        // annotations: checklistId → annotationId → annotation.
        const annotations = new Y.Map<unknown>();
        const perChecklist = new Y.Map<unknown>();
        const annotation = new Y.Map<unknown>();
        annotation.set('pdfId', 'pdf-uuid-1');
        annotation.set('embedPdfData', '{}');
        perChecklist.set('ann-1', annotation);
        annotations.set('cl-1', perChecklist);
        study.set('annotations', annotations);

        // reconciliations: per-outcome progress maps, shaped like the
        // updateReconciliationProgress writer in useProject/reconciliation.ts
        // (checklist1Id/checklist2Id/type are required by the transformer).
        const reconciliations = new Y.Map<unknown>();
        const progress = new Y.Map<unknown>();
        progress.set('checklist1Id', 'cl-1');
        progress.set('checklist2Id', 'cl-2');
        progress.set('outcomeId', 'outcome-1');
        progress.set('type', 'ROB2');
        progress.set('currentPage', 2);
        reconciliations.set('outcome-1', progress);
        study.set('reconciliations', reconciliations);
      });
    });

    const exported = (await stub.devExport()) as {
      formatVersion: number;
      meta: Record<string, unknown>;
      studies: Array<Record<string, unknown>>;
    };

    expect(exported.formatVersion).toBe(2);
    expect(exported.meta.outcomes).toEqual({
      'outcome-1': { name: 'Mortality', createdAt: 1700000000000, createdBy: 'user-1' },
    });

    const study = exported.studies.find(s => s.id === 'study-1')!;
    expect(study.name).toBe('Study 1');
    expect(study.reviewer1).toBe('user-1');
    // The toJSON duplicate of the maps re-exported in keyed form is dropped.
    expect(study).not.toHaveProperty('reconciliation');

    const checklists = study.checklists as Array<Record<string, unknown>>;
    const checklist = checklists.find(c => c.id === 'cl-1')!;
    expect(checklist.outcomeId).toBe('outcome-1');
    expect(checklist.reviewerName).toBe('Ada');
    expect(checklist.status).toBe('in_progress');
    expect((checklist.answers as Record<string, unknown>)['d1_1']).toBe('Y');
    expect((checklist.answers as Record<string, unknown>)['d1_1.comment']).toBe('free text');

    const pdfs = study.pdfs as Array<Record<string, unknown>>;
    expect(pdfs).toHaveLength(2);
    const legacyPdf = pdfs.find(p => p.fileName === 'paper.pdf')!;
    expect(legacyPdf.key).toBe('r2-key-legacy');
    expect(legacyPdf).not.toHaveProperty('id'); // no id fabricated from the map key
    const webPdf = pdfs.find(p => p.fileName === 'web.pdf')!;
    expect(webPdf.id).toBe('pdf-uuid-1');
    expect(webPdf.tag).toBe('primary');
    expect(webPdf.title).toBe('A Title');

    const annotations = study.annotations as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(annotations['cl-1']['ann-1'].pdfId).toBe('pdf-uuid-1');

    const reconciliations = study.reconciliations as Record<string, Record<string, unknown>>;
    expect(reconciliations['outcome-1']).toEqual({
      checklist1Id: 'cl-1',
      checklist2Id: 'cl-2',
      outcomeId: 'outcome-1',
      type: 'ROB2',
      currentPage: 2,
    });
  });

  it('MIGRATION_FREEZE 503s the upgrade handshake but not the devExport RPC', async () => {
    const stub = getStub();
    await stub.syncProject({ meta: { name: 'frozen' }, members: [] });

    await runInDurableObject(stub, async (instance: ProjectDoc) => {
      (instance as unknown as { env: Record<string, unknown> }).env.MIGRATION_FREEZE = 'true';
      const res = await instance.fetch(
        new Request('https://do/api/project-doc/x', { headers: { Upgrade: 'websocket' } }),
      );
      expect(res.status).toBe(503);
    });

    // The export route calls this RPC directly, bypassing the frozen fetch.
    const exported = (await stub.devExport()) as { formatVersion: number };
    expect(exported.formatVersion).toBe(2);
  });
});
