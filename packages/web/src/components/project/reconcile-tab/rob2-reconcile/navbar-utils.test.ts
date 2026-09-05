import { describe, it, expect } from 'vitest';
import { compareChecklists } from '@corates/shared/checklists/rob2';
import { getConsensusSkippedQuestions, hasNavItemAnswer, NAV_ITEM_TYPES } from './navbar-utils';

type Answers = Record<string, string | null>;

function checklist(domainKey: string, answers: Answers, aim = 'ASSIGNMENT') {
  const domainAnswers: Record<string, { answer: string | null }> = {};
  for (const [key, answer] of Object.entries(answers)) domainAnswers[key] = { answer };
  return { preliminary: { aim }, [domainKey]: { answers: domainAnswers } } as any;
}

describe('getConsensusSkippedQuestions', () => {
  it('skips downstream questions from the reviewers agreed upstream answer before the consensus records it', () => {
    const r1 = checklist('domain1', { d1_2: 'N' });
    const r2 = checklist('domain1', { d1_2: 'N' });
    const consensus = checklist('domain1', {});

    const skipped = getConsensusSkippedQuestions(consensus, compareChecklists(r1, r2));

    expect(skipped.has('d1_1')).toBe(true);
    expect(skipped.has('d1_3')).toBe(true);
    expect(skipped.has('d1_2')).toBe(false);
  });

  it('shows the user-reported case: 2.3 to 2.5 skip after agreed 2.1 = N and 2.2 = N while 2.6 is still open', () => {
    const r1 = checklist('domain2a', { d2a_1: 'N', d2a_2: 'N', d2a_6: 'Y' });
    const r2 = checklist('domain2a', { d2a_1: 'N', d2a_2: 'N', d2a_6: 'N' });
    const consensus = checklist('domain2a', {});

    const skipped = getConsensusSkippedQuestions(consensus, compareChecklists(r1, r2));

    // 2.7 hinges on the unresolved 2.6, so it stays pending rather than skipped.
    expect([...skipped].sort()).toEqual(['d2a_3', 'd2a_4', 'd2a_5']);
  });

  it('lets a consensus answer override the reviewers agreement', () => {
    const r1 = checklist('domain1', { d1_2: 'N' });
    const r2 = checklist('domain1', { d1_2: 'N' });
    const consensus = checklist('domain1', { d1_2: 'Y' });

    const skipped = getConsensusSkippedQuestions(consensus, compareChecklists(r1, r2));

    expect(skipped.has('d1_1')).toBe(false);
  });

  it('assumes nothing where the reviewers disagree', () => {
    const r1 = checklist('domain1', { d1_2: 'N' });
    const r2 = checklist('domain1', { d1_2: 'Y' });
    const consensus = checklist('domain1', {});

    expect(getConsensusSkippedQuestions(consensus, compareChecklists(r1, r2)).size).toBe(0);
  });

  it('keeps a branch pending while the reviewers disagree on the question that decides it', () => {
    // Both completions stamped NA on 3.4, but 3.2 and 3.3 hinge on the
    // unresolved 3.1 and must not read as skipped yet.
    const r1 = checklist('domain3', { d3_1: 'Y', d3_2: 'NA', d3_3: 'NA', d3_4: 'NA' });
    const r2 = checklist('domain3', { d3_1: 'N', d3_2: 'N', d3_3: 'N', d3_4: 'NA' });
    const consensus = checklist('domain3', {});

    expect(getConsensusSkippedQuestions(consensus, compareChecklists(r1, r2)).size).toBe(0);

    const resolved = checklist('domain3', { d3_1: 'Y' });
    const skipped = getConsensusSkippedQuestions(resolved, compareChecklists(r1, r2));
    expect([...skipped].sort()).toEqual(['d3_2', 'd3_3', 'd3_4']);
  });

  it('never marks a question with a consensus answer as skipped', () => {
    const r1 = checklist('domain1', { d1_2: 'N' });
    const r2 = checklist('domain1', { d1_2: 'N' });
    const consensus = checklist('domain1', { d1_1: 'Y' });

    const skipped = getConsensusSkippedQuestions(consensus, compareChecklists(r1, r2));

    expect(skipped.has('d1_1')).toBe(false);
    expect(skipped.has('d1_3')).toBe(true);
  });

  it('falls back to the consensus answers alone without a comparison', () => {
    const consensus = checklist('domain1', { d1_2: 'N' });

    const skipped = getConsensusSkippedQuestions(consensus, null);

    expect(skipped.has('d1_1')).toBe(true);
  });
});

describe('hasNavItemAnswer', () => {
  it('treats a consensus-skipped question as answered', () => {
    const r1 = checklist('domain1', { d1_2: 'N' });
    const r2 = checklist('domain1', { d1_2: 'N' });
    const consensus = checklist('domain1', {});
    const item = {
      type: NAV_ITEM_TYPES.DOMAIN_QUESTION,
      key: 'd1_1',
      domainKey: 'domain1',
      label: '1.1',
      section: 'Domain 1',
      sectionKey: 'domain1',
    } as const;

    expect(hasNavItemAnswer(item, consensus, compareChecklists(r1, r2))).toBe(true);
    expect(hasNavItemAnswer(item, consensus, null)).toBe(false);
  });
});
