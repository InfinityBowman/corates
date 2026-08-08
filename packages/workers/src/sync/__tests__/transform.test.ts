/**
 * Cutover rehearsal: a patched old-plane export → transform → a REAL
 * WorkspaceDO import → export → invariant checks. This is the §9 pipeline
 * end to end minus the network, so the transformer can never drift from
 * what the engine actually accepts.
 */

import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import { answerRowId, defaultAnswerRows } from '@corates/shared/sync';
import { projectWorkspace } from '../admin';
import { transformProjectExport } from '../transform';
import { verifyProjectMigration } from '../verify';

const NOW_ISO = '2026-08-01T12:00:00.000Z';

/** A representative patched (formatVersion 2) old-plane export. */
function buildOldExport(projectId: string) {
  return {
    formatVersion: 2,
    projectId,
    exportedAt: NOW_ISO,
    meta: {
      name: 'Migration Fixture',
      outcomes: {
        'outcome-1': { name: 'Mortality', createdAt: NOW_ISO, createdBy: 'user-a' },
      },
    },
    members: [{ userId: 'user-a', role: 'owner' }],
    studies: [
      {
        id: 'study-1',
        name: 'Page et al. 2021',
        description: 'PRISMA update',
        createdAt: NOW_ISO,
        updatedAt: 1_753_500_000_000,
        originalTitle: 'The PRISMA 2020 statement',
        firstAuthor: 'Page',
        publicationYear: 2021,
        doi: '10.1136/bmj.n71',
        importSource: 'pubmed',
        volume: '372',
        issue: '8284',
        pages: 'n71',
        type: 'journal-article',
        reviewer1: 'user-a',
        reviewer2: 'user-b',
        checklists: [
          {
            // Flat answers (post flat-key migration), finalized: rows only.
            id: 'chk-a2',
            type: 'AMSTAR2',
            title: 'AMSTAR2 Checklist',
            assignedTo: 'user-a',
            status: CHECKLIST_STATUS.FINALIZED,
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
            answers: {
              'q1.answers': [[true, false, false, false]],
              'q1.critical': true,
              'q1.note': 'Individual reviewer note',
              'stale.key': 'dropped by design',
            },
          },
          {
            // Nested legacy answers (doc untouched since the flat-key
            // migration shipped): flattens through expandAnswerUpdate. Also
            // carries the pre-2025-12-29 status vocabulary.
            id: 'chk-nested',
            type: 'AMSTAR2',
            assignedTo: 'user-b',
            status: 'awaiting-reconcile',
            createdAt: 1_753_400_000_000,
            updatedAt: 1_753_400_000_000,
            answers: {
              q2: { answers: [[true], [false, true]], critical: false, note: 'Nested note' },
            },
          },
        ],
        pdfs: [
          {
            fileName: 'page-2021.pdf',
            key: 'projects/p/studies/study-1/page-2021.pdf',
            size: 1234,
            uploadedBy: 'user-a',
            uploadedAt: NOW_ISO,
            tag: 'primary',
            title: 'The PRISMA 2020 statement',
          },
        ],
        annotations: {
          'chk-a2': {
            'ann-1': {
              id: 'ann-1',
              pdfId: 'pdf:projects/p/studies/study-1/page-2021.pdf',
              type: 'highlight',
              pageIndex: 2,
              embedPdfData: '{"rects":[]}',
              createdBy: 'user-a',
              createdAt: NOW_ISO,
            },
          },
        },
      },
      {
        id: 'study-2',
        name: 'Sterne et al. 2019',
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
        reviewer1: 'user-a',
        reviewer2: 'user-b',
        checklists: [
          {
            id: 'chk-r1',
            type: 'ROB2',
            assignedTo: 'user-a',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
            outcomeId: 'outcome-1',
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
            answers: { d1_1: 'Y', 'd1_1.comment': 'Reviewer 1 comment' },
          },
          {
            id: 'chk-r2',
            type: 'ROB2',
            assignedTo: 'user-b',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
            outcomeId: 'outcome-1',
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
            answers: { d1_1: 'PY', 'd1_1.comment': 'Reviewer 2 comment' },
          },
          {
            // In-progress consensus checklist: its prose seeds Yjs fields.
            id: 'chk-consensus',
            type: 'ROB2',
            assignedTo: null,
            status: CHECKLIST_STATUS.RECONCILING,
            outcomeId: 'outcome-1',
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
            answers: {
              d1_1: 'Y',
              'd1_1.comment': 'Consolidated: both reviewers agree on randomization',
              'preliminary.experimental': 'Drug A 10mg',
            },
          },
        ],
        pdfs: [],
        reconciliations: {
          'outcome-1': {
            checklist1Id: 'chk-r1',
            checklist2Id: 'chk-r2',
            reconciledChecklistId: 'chk-consensus',
            type: 'ROB2',
            outcomeId: 'outcome-1',
            currentPage: 3,
            viewMode: 'questions',
            updatedAt: NOW_ISO,
          },
        },
      },
      {
        id: 'study-3',
        name: 'Higgins et al. 2020',
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
        reviewer1: 'user-a',
        reviewer2: 'user-b',
        checklists: [
          {
            id: 'chk-ri-1',
            type: 'ROBINS_I',
            assignedTo: 'user-a',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
            outcomeId: 'outcome-1',
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
            answers: { 'sectionB.b1': 'Y' },
          },
          {
            id: 'chk-ri-2',
            type: 'ROBINS_I',
            assignedTo: 'user-b',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
            outcomeId: 'outcome-1',
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
            answers: { 'sectionB.b1': 'PY' },
          },
          {
            // In-progress ROBINS-I consensus carrying a Section B comment
            // under the legacy reconcile-session alias (`b1.comment`); the
            // transformer must salvage it into `sectionB.b1.comment`.
            id: 'chk-ri-consensus',
            type: 'ROBINS_I',
            assignedTo: null,
            status: CHECKLIST_STATUS.RECONCILING,
            outcomeId: 'outcome-1',
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
            answers: {
              'sectionB.b1': 'Y',
              'b1.comment': 'Consolidated: eligible per protocol',
            },
          },
        ],
        pdfs: [],
        reconciliations: {
          'outcome-1': {
            checklist1Id: 'chk-ri-1',
            checklist2Id: 'chk-ri-2',
            reconciledChecklistId: 'chk-ri-consensus',
            type: 'ROBINS_I',
            outcomeId: 'outcome-1',
            updatedAt: NOW_ISO,
          },
        },
      },
    ],
  };
}

describe('transformProjectExport', () => {
  it('refuses the shipped (lossy) v1 export format', () => {
    expect(() =>
      transformProjectExport({ version: 1, projectId: 'p', meta: {}, studies: [] }),
    ).toThrow(/failed validation/);
  });

  it('refuses outcome-scoped checklists without an outcomeId', () => {
    const oldExport = buildOldExport('p-bad');
    delete (oldExport.studies[1].checklists[0] as { outcomeId?: string }).outcomeId;
    expect(() => transformProjectExport(oldExport)).toThrow(/has no outcomeId/);
  });

  it('maps the pre-2025-12-29 status vocabulary onto the live enum', () => {
    const { snapshot, report } = transformProjectExport(buildOldExport('p-status'));
    const nested = snapshot.rows.find(row => row.tbl === 'checklists' && row.id === 'chk-nested');
    expect(nested?.data.status).toBe(CHECKLIST_STATUS.REVIEWER_COMPLETED);
    expect(report.warnings).toContain(
      'checklist chk-nested: legacy status "awaiting-reconcile" mapped to "reviewer-completed"',
    );
  });

  it('hard-fails at transform time when a row misses the live schema', () => {
    const oldExport = buildOldExport('p-invalid');
    (oldExport.studies[0].checklists[0] as { status: string }).status = 'bogus-status';
    expect(() => transformProjectExport(oldExport)).toThrow(/fail the live schema/);
  });

  it('maps the old plane onto rows and field seeds', () => {
    const { snapshot, report } = transformProjectExport(buildOldExport('p-map'));

    expect(report.studies).toBe(3);
    expect(report.checklists).toBe(8);
    expect(report.outcomes).toBe(1);
    expect(report.pdfs).toBe(1);
    expect(report.annotations).toBe(1);
    expect(report.reconciliations).toBe(2);
    expect(report.droppedAnswerKeys).toEqual(['chk-a2:stale.key']);
    // Two non-empty text answers on the ROB2 consensus, one salvaged legacy
    // Section B comment on the ROBINS-I consensus.
    expect(report.fieldSeeds).toBe(3);
    expect(Object.keys(snapshot.extension?.fields ?? {})).toEqual(
      expect.arrayContaining([
        answerRowId('chk-consensus', 'd1_1.comment'),
        answerRowId('chk-consensus', 'preliminary.experimental'),
        answerRowId('chk-ri-consensus', 'sectionB.b1.comment'),
      ]),
    );

    // The legacy alias lands on the canonical row, is reported, not dropped.
    const salvaged = snapshot.rows.find(
      row =>
        row.tbl === 'answers' && row.id === answerRowId('chk-ri-consensus', 'sectionB.b1.comment'),
    );
    expect(salvaged?.data.value).toBe('Consolidated: eligible per protocol');
    expect(report.droppedAnswerKeys).not.toContain('chk-ri-consensus:b1.comment');
    expect(report.warnings).toContain(
      'checklist chk-ri-consensus: remapped legacy key "b1.comment" to "sectionB.b1.comment"',
    );

    // Every checklist materializes its full default row set.
    const answerRows = snapshot.rows.filter(row => row.tbl === 'answers');
    const perChecklist = answerRows.filter(row => row.data.checklistId === 'chk-a2');
    expect(perChecklist.length).toBe(Object.keys(defaultAnswerRows('AMSTAR2')).length);

    // Nested legacy answers flattened through the app's own expansion.
    const nestedNote = snapshot.rows.find(
      row => row.tbl === 'answers' && row.id === answerRowId('chk-nested', 'q2.note'),
    );
    expect(nestedNote?.data.value).toBe('Nested note');
    const nestedAnswer = snapshot.rows.find(
      row => row.tbl === 'answers' && row.id === answerRowId('chk-nested', 'q2.answers'),
    );
    expect(nestedAnswer?.data.value).toEqual([[true], [false, true]]);

    // ISO timestamps coerced to epoch numbers.
    const study = snapshot.rows.find(row => row.tbl === 'studies' && row.id === 'study-1');
    expect(study?.data.createdAt).toBe(Date.parse(NOW_ISO));
    expect(study?.data.updatedAt).toBe(1_753_500_000_000);

    // Citation metadata carries through the row literal in full.
    expect(study?.data).toMatchObject({
      originalTitle: 'The PRISMA 2020 statement',
      firstAuthor: 'Page',
      publicationYear: '2021',
      doi: '10.1136/bmj.n71',
      importSource: 'pubmed',
      volume: '372',
      issue: '8284',
      pages: 'n71',
      type: 'journal-article',
    });
  });
});

describe('cutover rehearsal against a real WorkspaceDO', () => {
  it('imports the transformed snapshot, exports it back, and passes the invariants', async () => {
    const projectId = 'transform-rehearsal';
    const oldExport = buildOldExport(projectId);
    const { snapshot } = transformProjectExport(oldExport);

    const workspace = projectWorkspace(env, projectId);
    const imported = await workspace.import(snapshot);
    expect(imported.imported).toBe(snapshot.rows.length);

    const engineExport = await workspace.export();
    const result = verifyProjectMigration(oldExport, engineExport);
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);

    // The invariants cover it, but assert the headline directly too: the
    // in-progress consolidated note is readable out of the engine's field
    // state, character for character.
    const fields = (engineExport as { extension?: { fields: Record<string, string> } }).extension
      ?.fields;
    expect(fields?.[answerRowId('chk-consensus', 'd1_1.comment')]).toBeTruthy();
  });
});
