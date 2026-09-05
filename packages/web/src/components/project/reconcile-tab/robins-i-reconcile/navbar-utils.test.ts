import { describe, it, expect } from 'vitest';
import { compareChecklists } from '@/components/checklist/ROBINSIChecklist/checklist-compare';
import { getConsensusSkippedQuestions } from './navbar-utils';

type Answers = Record<string, string | null>;

function checklist(domainKey: string, answers: Answers, sectionB: Answers = {}) {
  const domainAnswers: Record<string, { answer: string | null }> = {};
  for (const [key, answer] of Object.entries(answers)) domainAnswers[key] = { answer };
  const sectionBAnswers: Record<string, { answer: string | null }> = {};
  for (const [key, answer] of Object.entries(sectionB)) sectionBAnswers[key] = { answer };
  return {
    sectionB: sectionBAnswers,
    sectionC: { isPerProtocol: false },
    [domainKey]: { answers: domainAnswers },
  } as any;
}

describe('getConsensusSkippedQuestions', () => {
  it('skips downstream questions from the reviewers agreed upstream answer before the consensus records it', () => {
    const r1 = checklist('domain6', { d6_1: 'Y' });
    const r2 = checklist('domain6', { d6_1: 'Y' });
    const consensus = checklist('domain6', {});

    const skipped = getConsensusSkippedQuestions(consensus, compareChecklists(r1, r2));

    expect([...skipped].sort()).toEqual(['d6_2', 'd6_3', 'd6_4']);
  });

  it('assumes nothing where the reviewers disagree', () => {
    const r1 = checklist('domain6', { d6_1: 'Y' });
    const r2 = checklist('domain6', { d6_1: 'N' });
    const consensus = checklist('domain6', {});

    expect(getConsensusSkippedQuestions(consensus, compareChecklists(r1, r2)).size).toBe(0);
  });

  it('skips every domain question once the reviewers agree Section B is Critical', () => {
    const r1 = checklist('domain6', {}, { b1: 'N', b2: 'Y', b3: 'N' });
    const r2 = checklist('domain6', {}, { b1: 'N', b2: 'Y', b3: 'N' });
    const consensus = checklist('domain6', {});

    const skipped = getConsensusSkippedQuestions(consensus, compareChecklists(r1, r2));

    expect(skipped.has('d6_1')).toBe(true);
    expect(skipped.has('d2_1')).toBe(true);
  });
});
