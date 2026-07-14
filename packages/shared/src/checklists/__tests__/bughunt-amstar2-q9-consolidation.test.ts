/**
 * Bug hunt: AMSTAR2 q9a/q9b (and q11a/q11b) consolidation asymmetry.
 *
 * consolidateAnswers merges the two sub-questions of q9 (and q11) by "taking
 * the lower score". When exactly one sub-question is answered, the merge
 * always keeps the q9a object, so the rating depends on WHICH sub-question
 * was answered rather than on what was answered:
 *   - q9a=Yes, q9b unanswered  -> q9 treated as Yes (no critical flaw)
 *   - q9a unanswered, q9b=Yes  -> q9 treated as unanswered (critical flaw)
 *
 * The two states carry identical information, so scoreAMSTAR2Checklist must
 * rate them identically.
 *
 * Reachable today: the local appraisals dashboard export (CSV/PDF) calls
 * scoreChecklistOfType -> scoreAMSTAR2Checklist on in-progress checklists
 * without any completeness gate, so a reviewer who filled the NRSI part of
 * q9 first sees a different exported score than one who filled the RCT part
 * first.
 */

import { describe, it, expect } from 'vitest';
import {
  createAMSTAR2Checklist,
  scoreAMSTAR2Checklist,
} from '../amstar2/index.js';
import type { AMSTAR2Checklist, AMSTAR2Question } from '../types.js';

/**
 * Answer every question with its first final-column option (Yes), matching
 * the shape produced by createAMSTAR2Checklist.
 */
function makeAllYesChecklist(): AMSTAR2Checklist {
  const checklist = createAMSTAR2Checklist({ name: 'Test', id: 'chk-1' });
  const keys = [
    'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8',
    'q9a', 'q9b', 'q10', 'q11a', 'q11b', 'q12', 'q13', 'q14', 'q15', 'q16',
  ] as const;
  for (const key of keys) {
    const question = checklist[key] as AMSTAR2Question;
    const lastCol = question.answers[question.answers.length - 1];
    lastCol[0] = true; // Yes
  }
  return checklist;
}

function clearFinalAnswer(checklist: AMSTAR2Checklist, key: 'q9a' | 'q9b' | 'q11a' | 'q11b') {
  const question = checklist[key] as AMSTAR2Question;
  const lastCol = question.answers[question.answers.length - 1];
  lastCol.fill(false);
}

describe('AMSTAR2 consolidation must not depend on which sub-question is answered', () => {
  it('q9: score(q9a=Yes, q9b unanswered) equals score(q9a unanswered, q9b=Yes)', () => {
    const aAnswered = makeAllYesChecklist();
    clearFinalAnswer(aAnswered, 'q9b');

    const bAnswered = makeAllYesChecklist();
    clearFinalAnswer(bAnswered, 'q9a');

    const scoreA = scoreAMSTAR2Checklist(aAnswered);
    const scoreB = scoreAMSTAR2Checklist(bAnswered);
    expect(scoreA).toBe(scoreB);
  });

  it('q11: score(q11a=Yes, q11b unanswered) equals score(q11a unanswered, q11b=Yes)', () => {
    const aAnswered = makeAllYesChecklist();
    clearFinalAnswer(aAnswered, 'q11b');

    const bAnswered = makeAllYesChecklist();
    clearFinalAnswer(bAnswered, 'q11a');

    const scoreA = scoreAMSTAR2Checklist(aAnswered);
    const scoreB = scoreAMSTAR2Checklist(bAnswered);
    expect(scoreA).toBe(scoreB);
  });
});
