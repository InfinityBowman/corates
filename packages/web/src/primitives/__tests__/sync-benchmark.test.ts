/**
 * Sync manager performance benchmark.
 *
 * Builds a Y.Doc matching a real project scale (20 studies, 40 checklists)
 * and measures rebuild times. Fails if sync latency exceeds thresholds
 * that would cause visible UI lag.
 */

import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { createSyncManager } from '@/primitives/useProject/sync';

// Make requestAnimationFrame synchronous so we can measure the full sync cost
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  cb(0);
  return 0;
});

function buildProject(doc: Y.Doc, studyCount: number, checklistsPerStudy: number) {
  const reviews = doc.getMap('reviews');
  const members = doc.getMap('members');
  const meta = doc.getMap('meta');

  const memberA = new Y.Map();
  memberA.set('role', 'owner');
  memberA.set('joinedAt', Date.now());
  memberA.set('name', 'Alice');
  memberA.set('email', 'alice@test.com');
  memberA.set('givenName', 'Alice');
  memberA.set('familyName', 'Reviewer');
  memberA.set('image', null);
  members.set('user-a', memberA);

  const memberB = new Y.Map();
  memberB.set('role', 'member');
  memberB.set('joinedAt', Date.now());
  memberB.set('name', 'Bob');
  memberB.set('email', 'bob@test.com');
  memberB.set('givenName', 'Bob');
  memberB.set('familyName', 'Reviewer');
  memberB.set('image', null);
  members.set('user-b', memberB);

  meta.set('name', 'Benchmark Project');
  meta.set('description', 'Performance test');
  const outcomes = new Y.Map();
  const outcome = new Y.Map();
  outcome.set('name', 'Primary Outcome');
  outcome.set('createdAt', Date.now());
  outcomes.set('outcome-1', outcome);
  meta.set('outcomes', outcomes);

  doc.transact(() => {
    for (let s = 0; s < studyCount; s++) {
      const study = new Y.Map();
      study.set('name', `Study ${s + 1}`);
      study.set('description', `Description for study ${s + 1}`);
      study.set('originalTitle', `Original Title ${s + 1}`);
      study.set('firstAuthor', `Author${s + 1}`);
      study.set('publicationYear', '2024');
      study.set('authors', `Author${s + 1}, CoAuthor${s + 1}`);
      study.set('journal', 'Test Journal');
      study.set('doi', `10.1234/test.${s + 1}`);
      study.set('abstract', `Abstract text for study ${s + 1}. `.repeat(5));
      study.set('importSource', 'pdf');
      study.set('pdfUrl', null);
      study.set('pdfSource', 'upload');
      study.set('pdfAccessible', true);
      study.set('pmid', null);
      study.set('url', null);
      study.set('volume', '1');
      study.set('issue', '1');
      study.set('pages', `${s + 1}-${s + 10}`);
      study.set('type', null);
      study.set('reviewer1', 'user-a');
      study.set('reviewer2', 'user-b');
      study.set('createdAt', Date.now() - studyCount + s);
      study.set('updatedAt', Date.now());

      const checklists = new Y.Map();
      for (let c = 0; c < checklistsPerStudy; c++) {
        const checklist = new Y.Map();
        checklist.set('type', 'ROB2');
        checklist.set('title', `RoB 2 - Study ${s + 1}`);
        checklist.set('assignedTo', c % 2 === 0 ? 'user-a' : 'user-b');
        checklist.set('status', 'complete');
        checklist.set('createdAt', Date.now());
        checklist.set('updatedAt', Date.now());
        checklist.set('outcomeId', 'outcome-1');

        const answers = new Y.Map();

        // Preliminary section with Y.Text fields
        const preliminary = new Y.Map();
        preliminary.set('studyDesign', 'Individually-randomized parallel-group trial');
        const experimental = new Y.Text();
        experimental.insert(0, `Experimental intervention for study ${s + 1}`);
        preliminary.set('experimental', experimental);
        const comparator = new Y.Text();
        comparator.insert(0, `Comparator for study ${s + 1}`);
        preliminary.set('comparator', comparator);
        const numericalResult = new Y.Text();
        numericalResult.insert(0, 'RR 1.5 (95% CI 1.2-1.9)');
        preliminary.set('numericalResult', numericalResult);
        preliminary.set('aim', 'effect_of_assignment');
        preliminary.set('sources', { journal: true });
        answers.set('preliminary', preliminary);

        // 5 domains with nested questions and Y.Text comments
        const domainQuestions = [3, 5, 4, 5, 3];
        for (let d = 1; d <= 5; d++) {
          const domain = new Y.Map();
          domain.set('judgement', d % 3 === 0 ? 'High' : 'Low');
          const direction = new Y.Map();
          direction.set('value', 'NA');
          domain.set('direction', direction);

          const domainAnswers = new Y.Map();
          for (let q = 1; q <= domainQuestions[d - 1]; q++) {
            const question = new Y.Map();
            question.set('answer', q % 2 === 0 ? 'Y' : 'PY');
            const comment = new Y.Text();
            comment.insert(
              0,
              `Domain ${d} Q${q}: Reviewer assessment notes for study ${s + 1}.`,
            );
            question.set('comment', comment);
            domainAnswers.set(`${d}.${q}`, question);
          }
          domain.set('answers', domainAnswers);
          answers.set(`domain${d}`, domain);
        }

        // Overall judgement
        const overall = new Y.Map();
        overall.set('judgement', 'Some concerns');
        answers.set('overall', overall);

        checklist.set('answers', answers);
        checklists.set(`cl-${s}-${c}`, checklist);
      }
      study.set('checklists', checklists);

      const pdfs = new Y.Map();
      const pdf = new Y.Map();
      pdf.set('id', `pdf-${s}`);
      pdf.set('fileName', `study-${s + 1}.pdf`);
      pdf.set('key', `uploads/pdf-${s}`);
      pdf.set('size', 1024 * 1024);
      pdf.set('uploadedBy', 'user-a');
      pdf.set('uploadedAt', Date.now());
      pdf.set('tag', 'primary');
      pdf.set('title', null);
      pdf.set('firstAuthor', null);
      pdf.set('publicationYear', null);
      pdf.set('journal', null);
      pdf.set('doi', null);
      pdfs.set(`pdf-${s}`, pdf);
      study.set('pdfs', pdfs);

      reviews.set(`study-${s}`, study);
    }
  });
}

describe('sync manager benchmark', () => {
  it('full rebuild: 20 studies, 40 ROB2 checklists', () => {
    const doc = new Y.Doc();
    buildProject(doc, 20, 2);

    const sm = createSyncManager('bench', () => doc);
    sm.attach(doc);

    const start = performance.now();
    sm.syncFromYDocImmediate();
    const ms = performance.now() - start;

    // eslint-disable-next-line no-console
    console.log(`Full rebuild (20 studies, 40 checklists): ${ms.toFixed(2)}ms`);
    expect(ms).toBeLessThan(200);

    sm.detach();
  });

  it('incremental sync: single answer edit in a 20-study project', () => {
    const doc = new Y.Doc();
    buildProject(doc, 20, 2);

    const sm = createSyncManager('bench', () => doc);
    sm.attach(doc);
    sm.syncFromYDocImmediate();

    const reviews = doc.getMap('reviews');
    const study = reviews.get('study-10') as Y.Map<unknown>;
    const checklists = study.get('checklists') as Y.Map<unknown>;
    const checklist = checklists.get('cl-10-0') as Y.Map<unknown>;
    const answers = checklist.get('answers') as Y.Map<unknown>;
    const domain1 = answers.get('domain1') as Y.Map<unknown>;

    const start = performance.now();
    domain1.set('judgement', 'High');
    const ms = performance.now() - start;

    // eslint-disable-next-line no-console
    console.log(`Incremental sync (1 edit, 20-study project): ${ms.toFixed(2)}ms`);
    expect(ms).toBeLessThan(50);

    sm.detach();
  });

  it('incremental sync: rapid edits to different studies', () => {
    const doc = new Y.Doc();
    buildProject(doc, 20, 2);

    const sm = createSyncManager('bench', () => doc);
    sm.attach(doc);
    sm.syncFromYDocImmediate();

    const reviews = doc.getMap('reviews');

    const start = performance.now();
    for (let s = 0; s < 5; s++) {
      const study = reviews.get(`study-${s}`) as Y.Map<unknown>;
      const checklists = study.get('checklists') as Y.Map<unknown>;
      const checklist = checklists.get(`cl-${s}-0`) as Y.Map<unknown>;
      const answers = checklist.get('answers') as Y.Map<unknown>;
      const domain1 = answers.get('domain1') as Y.Map<unknown>;
      domain1.set('judgement', 'High');
    }
    const ms = performance.now() - start;

    // eslint-disable-next-line no-console
    console.log(`Rapid edits (5 studies touched, 20-study project): ${ms.toFixed(2)}ms`);
    expect(ms).toBeLessThan(100);

    sm.detach();
  });
});
