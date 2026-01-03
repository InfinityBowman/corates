import { describe, it, expect } from 'vitest';
import {
  scoreRobinsDomain,
  getEffectiveDomainJudgement,
  scoreAllDomains,
  mapOverallJudgementToDisplay,
  JUDGEMENTS,
} from '../scoring/robins-scoring.js';

// Helper to create answer objects
const ans = answer => ({ answer, comment: '' });
const answers = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, ans(v)]));

describe('scoreRobinsDomain', () => {
  describe('Domain 1A (ITT - Confounding)', () => {
    it('returns null for incomplete answers', () => {
      const result = scoreRobinsDomain('domain1a', {});
      expect(result.judgement).toBeNull();
      expect(result.isComplete).toBe(false);
    });

    it('Rule 1: Y/PY, N/PN/NI, Y/PY/WN, N/PN -> Low (except confounding)', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'Y', d1a_2: 'Y', d1a_3: 'N', d1a_4: 'N' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW_EXCEPT_CONFOUNDING);
      expect(result.ruleId).toBe('D1A.R1');
    });

    it('Rule 2: Y/PY, N/PN/NI, Y/PY/WN, Y/PY -> Moderate', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'PY', d1a_2: 'PY', d1a_3: 'PN', d1a_4: 'Y' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D1A.R2');
    });

    it('Rule 3: Y/PY, N/PN/NI, SN/NI, any -> Serious', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'Y', d1a_2: 'SN', d1a_3: 'N', d1a_4: 'N' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D1A.R3');
    });

    it('Rule 4: Y/PY, Y/PY (post-intervention), any, Y/PY -> Critical', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'Y', d1a_2: 'Y', d1a_3: 'Y', d1a_4: 'Y' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D1A.R4');
    });

    it('Rule 5: Y/PY, Y/PY, any, N/PN -> Serious', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'PY', d1a_2: 'Y', d1a_3: 'PY', d1a_4: 'PN' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D1A.R5');
    });

    it('Rule 8: SN/NI (not controlled), any, any, Y/PY -> Critical', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'SN', d1a_2: 'Y', d1a_3: 'N', d1a_4: 'Y' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D1A.R8');
    });

    it('Rule 9: SN/NI, any, any, N/PN -> Serious', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'NI', d1a_2: 'Y', d1a_3: 'N', d1a_4: 'PN' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D1A.R9');
    });
  });

  describe('Domain 1B (Per-Protocol - Confounding)', () => {
    it('Rule 1: Y/PY (analysis), Y/PY (controlled), Y/PY (valid), any, N/PN -> Low', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'Y',
          d1b_2: 'Y',
          d1b_3: 'PY',
          d1b_4: 'N',
          d1b_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D1B.R1');
    });

    it('Rule 3: Y/PY, WN, Y/PY/WN, any, N/PN -> Low (except confounding)', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'PY',
          d1b_2: 'WN',
          d1b_3: 'WN',
          d1b_4: 'N',
          d1b_5: 'PN',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW_EXCEPT_CONFOUNDING);
      expect(result.ruleId).toBe('D1B.R3');
    });

    it('Rule 6: N/PN/NI (analysis), any, any, Y/PY (post-interv), any -> Critical', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'N',
          d1b_2: 'Y',
          d1b_3: 'Y',
          d1b_4: 'Y',
          d1b_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D1B.R6');
    });

    it('Rule 8: N/PN/NI, any, any, N/PN/NI, N/PN -> Serious', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'PN',
          d1b_2: 'Y',
          d1b_3: 'Y',
          d1b_4: 'PN',
          d1b_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D1B.R8');
    });
  });

  describe('Domain 2 (Classification of Interventions)', () => {
    it('Rule 1: Y/PY (distinguishable), any, any, N/PN (no outcome dep), N/PN -> Low', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'Y',
          d2_2: 'N',
          d2_3: 'N',
          d2_4: 'N',
          d2_5: 'PN',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D2.R1');
    });

    it('Rule 4: Y/PY, any, any, SY (strong outcome dep), any -> Serious', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'PY',
          d2_2: 'N',
          d2_3: 'N',
          d2_4: 'SY',
          d2_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D2.R4');
    });

    it('Rule 7: N/PN/NI, N/PN/NI, N/PN (no appropriate analysis), SY/WY/NI, any -> Critical', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'N',
          d2_2: 'PN',
          d2_3: 'N',
          d2_4: 'WY',
          d2_5: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D2.R7');
    });
  });

  describe('Domain 3 (Selection Bias - Multi-step)', () => {
    it('All Low in Part A and B -> Low', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          // Part A: Y/PY followed from start, N/PN/NI early events -> Low
          d3_1: 'Y',
          d3_2: 'N',
          // Part B: N/PN no post-start selection -> Low
          d3_3: 'N',
          d3_4: 'N',
          d3_5: 'N',
          // Correction questions (not needed when both Low)
          d3_6: 'N',
          d3_7: 'N',
          d3_8: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D3.R1');
    });

    it('Part A Moderate, Part B Low -> Moderate', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          // Part A: Y/PY, Y/PY -> Moderate
          d3_1: 'Y',
          d3_2: 'Y',
          // Part B: N/PN -> Low
          d3_3: 'PN',
          d3_4: 'N',
          d3_5: 'N',
          d3_6: 'N',
          d3_7: 'N',
          d3_8: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D3.R2');
    });

    it('Part A Serious (SN, corrected from SY in table), Part B Low, corrected -> Moderate', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          // Part A: SN -> Serious
          d3_1: 'SN',
          d3_2: 'N',
          // Part B: N/PN -> Low
          d3_3: 'N',
          d3_4: 'N',
          d3_5: 'N',
          // Corrected or sensitivity OK -> downgrades to Moderate
          d3_6: 'Y',
          d3_7: 'N',
          d3_8: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D3.R3');
    });

    it('Part A Serious, not corrected, not severe -> Serious', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          d3_1: 'SN',
          d3_2: 'N',
          d3_3: 'N',
          d3_4: 'N',
          d3_5: 'N',
          d3_6: 'N',
          d3_7: 'PN',
          d3_8: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D3.R4');
    });

    it('Part B Serious, not corrected, severe -> Critical', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          d3_1: 'Y',
          d3_2: 'N',
          // Part B: Y/PY, Y/PY, Y/PY -> Serious
          d3_3: 'Y',
          d3_4: 'Y',
          d3_5: 'Y',
          d3_6: 'N',
          d3_7: 'N',
          d3_8: 'Y', // Severe enough to exclude
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D3.R5');
    });
  });

  describe('Domain 4 (Missing Data)', () => {
    it('Rule 1: All complete data Y/PY -> Low', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'Y',
          d4_2: 'PY',
          d4_3: 'Y',
          d4_4: 'NA',
          d4_5: 'NA',
          d4_6: 'NA',
          d4_7: 'NA',
          d4_8: 'NA',
          d4_9: 'NA',
          d4_10: 'NA',
          d4_11: 'NA',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D4.R1');
    });

    it('Rule 2: Missing data, complete-case, not outcome-related -> Low', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'N',
          d4_2: 'Y',
          d4_3: 'Y',
          d4_4: 'Y', // Complete-case
          d4_5: 'N', // Not outcome-related
          d4_6: 'NA',
          d4_7: 'N',
          d4_8: 'NA',
          d4_9: 'NA',
          d4_10: 'NA',
          d4_11: 'NA',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D4.R2');
    });

    it('Rule 5: Missing data, imputation, MAR/MCAR + appropriate -> Low', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'PN',
          d4_2: 'Y',
          d4_3: 'Y',
          d4_4: 'N',
          d4_5: 'NA',
          d4_6: 'NA',
          d4_7: 'Y', // Imputation
          d4_8: 'Y', // MAR/MCAR
          d4_9: 'Y', // Appropriate
          d4_10: 'NA',
          d4_11: 'NA',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D4.R5');
    });

    it('Rule 7: Missing data, imputation, weak/unclear, evidence not biased N/PN -> Serious', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'N',
          d4_2: 'Y',
          d4_3: 'Y',
          d4_4: 'N',
          d4_5: 'Y',
          d4_6: 'NA',
          d4_7: 'Y',
          d4_8: 'Y',
          d4_9: 'WN', // Weak
          d4_10: 'NA',
          d4_11: 'N', // Not biased N
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D4.R7');
    });

    it('Rule 8: Missing data, poor/none method, evidence not biased N/PN -> Critical', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'N',
          d4_2: 'N',
          d4_3: 'N',
          d4_4: 'N', // Not complete case
          d4_5: 'Y',
          d4_6: 'NA',
          d4_7: 'N', // Not imputation
          d4_8: 'NA',
          d4_9: 'NA',
          d4_10: 'NA',
          d4_11: 'N', // Not biased N
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D4.R8');
    });
  });

  describe('Domain 5 (Measurement of Outcome)', () => {
    it('Rule 1: Y/PY (differs by intervention) -> Serious', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'Y',
          d5_2: 'N',
          d5_3: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D5.R1');
    });

    it('Rule 2: N/PN, N/PN -> Low', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'N',
          d5_2: 'PN',
          d5_3: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D5.R2');
    });

    it('Rule 4: N/PN, Y/PY/NI, WY/NI -> Moderate', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'PN',
          d5_2: 'Y',
          d5_3: 'WY',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D5.R4');
    });

    it('Rule 5: N/PN, Y/PY/NI, SY -> Serious', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'N',
          d5_2: 'PY',
          d5_3: 'SY',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D5.R5');
    });
  });

  describe('Domain 6 (Selection of Reported Result)', () => {
    it('Rule 1: Y/PY (prespecified) -> Low', () => {
      const result = scoreRobinsDomain(
        'domain6',
        answers({
          d6_1: 'Y',
          d6_2: 'N',
          d6_3: 'N',
          d6_4: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D6.R1');
    });

    it('Rule 2: N/PN/NI, 0 Y/PY, no NI -> Low', () => {
      const result = scoreRobinsDomain(
        'domain6',
        answers({
          d6_1: 'N',
          d6_2: 'N',
          d6_3: 'PN',
          d6_4: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D6.R2');
    });

    it('Rule 3: N/PN/NI, 0 Y/PY, has NI (but not all) -> Moderate', () => {
      const result = scoreRobinsDomain(
        'domain6',
        answers({
          d6_1: 'PN',
          d6_2: 'N',
          d6_3: 'NI',
          d6_4: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D6.R3');
    });

    it('Rule 4: N/PN/NI, 1 Y/PY -> Serious', () => {
      const result = scoreRobinsDomain(
        'domain6',
        answers({
          d6_1: 'N',
          d6_2: 'Y',
          d6_3: 'N',
          d6_4: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D6.R4');
    });

    it('Rule 5: N/PN/NI, >=2 Y/PY -> Critical', () => {
      const result = scoreRobinsDomain(
        'domain6',
        answers({
          d6_1: 'NI',
          d6_2: 'Y',
          d6_3: 'PY',
          d6_4: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D6.R5');
    });

    it('Rule 6: N/PN/NI, 0 Y/PY, all NI -> Serious', () => {
      const result = scoreRobinsDomain(
        'domain6',
        answers({
          d6_1: 'N',
          d6_2: 'NI',
          d6_3: 'NI',
          d6_4: 'NI',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D6.R6');
    });
  });
});

describe('getEffectiveDomainJudgement', () => {
  it('returns auto judgement when source is auto', () => {
    const domainState = { judgementSource: 'auto', judgement: null };
    const autoScore = { judgement: JUDGEMENTS.MODERATE };
    expect(getEffectiveDomainJudgement(domainState, autoScore)).toBe(JUDGEMENTS.MODERATE);
  });

  it('returns manual judgement when source is manual and judgement exists', () => {
    const domainState = { judgementSource: 'manual', judgement: JUDGEMENTS.SERIOUS };
    const autoScore = { judgement: JUDGEMENTS.LOW };
    expect(getEffectiveDomainJudgement(domainState, autoScore)).toBe(JUDGEMENTS.SERIOUS);
  });

  it('falls back to auto when manual but no judgement set', () => {
    const domainState = { judgementSource: 'manual', judgement: null };
    const autoScore = { judgement: JUDGEMENTS.LOW };
    expect(getEffectiveDomainJudgement(domainState, autoScore)).toBe(JUDGEMENTS.LOW);
  });
});

describe('scoreAllDomains', () => {
  it('returns incomplete when not all domains are scored', () => {
    const checklistState = {
      sectionC: { isPerProtocol: false },
      domain1a: { answers: {} },
      domain2: { answers: {} },
      domain3: { answers: {} },
      domain4: { answers: {} },
      domain5: { answers: {} },
      domain6: { answers: {} },
    };
    const result = scoreAllDomains(checklistState);
    expect(result.isComplete).toBe(false);
    expect(result.overall).toBeNull();
  });
});

describe('mapOverallJudgementToDisplay', () => {
  it('maps Low to display string', () => {
    expect(mapOverallJudgementToDisplay(JUDGEMENTS.LOW)).toBe(
      'Low risk of bias except for concerns about uncontrolled confounding',
    );
  });

  it('maps Moderate to display string', () => {
    expect(mapOverallJudgementToDisplay(JUDGEMENTS.MODERATE)).toBe('Moderate risk');
  });

  it('maps Serious to display string', () => {
    expect(mapOverallJudgementToDisplay(JUDGEMENTS.SERIOUS)).toBe('Serious risk');
  });

  it('maps Critical to display string', () => {
    expect(mapOverallJudgementToDisplay(JUDGEMENTS.CRITICAL)).toBe('Critical risk');
  });
});
