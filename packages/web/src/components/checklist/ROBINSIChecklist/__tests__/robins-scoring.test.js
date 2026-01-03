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
    it('returns null for incomplete answers (missing Q1)', () => {
      const result = scoreRobinsDomain('domain1a', {});
      expect(result.judgement).toBeNull();
      expect(result.isComplete).toBe(false);
    });

    it('returns null when Q1 answered but Q3 missing (Y/PY path)', () => {
      const result = scoreRobinsDomain('domain1a', answers({ d1a_1: 'Y' }));
      expect(result.judgement).toBeNull();
      expect(result.isComplete).toBe(false);
    });

    it('Path: Q1=Y/PY -> Q3a=N/PN/NI -> Q2a=Y/PY -> NC2=N/PN -> LOW_EX', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'Y', d1a_2: 'Y', d1a_3: 'N', d1a_4: 'N' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW_EXCEPT_CONFOUNDING);
      expect(result.ruleId).toBe('D1A.R1');
    });

    it('Path: Q1=Y/PY -> Q3a=N/PN/NI -> Q2a=Y/PY -> NC2=Y/PY -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'PY', d1a_2: 'PY', d1a_3: 'PN', d1a_4: 'Y' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D1A.R2');
    });

    it('Path: Q1=Y/PY -> Q3a=N/PN/NI -> Q2a=WN -> NC2=N/PN -> LOW_EX', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'Y', d1a_2: 'WN', d1a_3: 'N', d1a_4: 'N' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW_EXCEPT_CONFOUNDING);
      expect(result.ruleId).toBe('D1A.R1');
    });

    it('Path: Q1=Y/PY -> Q3a=N/PN/NI -> Q2a=SN/NI -> SER (terminal)', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'Y', d1a_2: 'SN', d1a_3: 'N' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D1A.R3');
    });

    it('Path: Q1=Y/PY -> Q3a=Y/PY -> NC3=N/PN -> SER', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'PY', d1a_3: 'Y', d1a_4: 'PN' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D1A.R5');
    });

    it('Path: Q1=Y/PY -> Q3a=Y/PY -> NC3=Y/PY -> CRIT', () => {
      const result = scoreRobinsDomain('domain1a', answers({ d1a_1: 'Y', d1a_3: 'Y', d1a_4: 'Y' }));
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D1A.R4');
    });

    it('Path: Q1=WN -> Q3b=N/PN/NI -> Q2b=Y/PY/WN -> NC2=N/PN -> LOW_EX', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'WN', d1a_2: 'WN', d1a_3: 'N', d1a_4: 'N' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW_EXCEPT_CONFOUNDING);
      expect(result.ruleId).toBe('D1A.R1');
    });

    it('Path: Q1=WN -> Q3b=Y/PY -> NC4=N/PN -> SER', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'WN', d1a_3: 'Y', d1a_4: 'N' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D1A.R6');
    });

    it('Path: Q1=WN -> Q3b=Y/PY -> NC4=Y/PY -> CRIT', () => {
      const result = scoreRobinsDomain(
        'domain1a',
        answers({ d1a_1: 'WN', d1a_3: 'Y', d1a_4: 'Y' }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D1A.R7');
    });

    it('Path: Q1=SN/NI -> NC1=N/PN -> SER', () => {
      const result = scoreRobinsDomain('domain1a', answers({ d1a_1: 'SN', d1a_4: 'PN' }));
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D1A.R8');
    });

    it('Path: Q1=SN/NI -> NC1=Y/PY -> CRIT', () => {
      const result = scoreRobinsDomain('domain1a', answers({ d1a_1: 'NI', d1a_4: 'Y' }));
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D1A.R9');
    });
  });

  describe('Domain 1B (Per-Protocol - Confounding)', () => {
    it('returns null for incomplete answers (missing Q1)', () => {
      const result = scoreRobinsDomain('domain1b', {});
      expect(result.judgement).toBeNull();
      expect(result.isComplete).toBe(false);
    });

    it('Path: Q1=Y/PY -> Q2=Y/PY -> Q3a=Y/PY -> NC1=N/PN -> LOW', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'Y',
          d1b_2: 'Y',
          d1b_3: 'PY',
          d1b_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D1B.R1');
    });

    it('Path: Q1=Y/PY -> Q2=Y/PY -> Q3a=Y/PY -> NC1=Y/PY -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'PY',
          d1b_2: 'Y',
          d1b_3: 'Y',
          d1b_5: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D1B.R2');
    });

    it('Path: Q1=Y/PY -> Q2=Y/PY -> Q3a=WN -> NC2=N/PN -> LOW_EX', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'Y',
          d1b_2: 'Y',
          d1b_3: 'WN',
          d1b_5: 'PN',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW_EXCEPT_CONFOUNDING);
      expect(result.ruleId).toBe('D1B.R3');
    });

    it('Path: Q1=Y/PY -> Q2=WN -> Q3b=Y/PY/WN -> NC2=N/PN -> LOW_EX', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'PY',
          d1b_2: 'WN',
          d1b_3: 'WN',
          d1b_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW_EXCEPT_CONFOUNDING);
      expect(result.ruleId).toBe('D1B.R3');
    });

    it('Path: Q1=Y/PY -> Q2=SN/NI -> SER (terminal)', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'Y',
          d1b_2: 'SN',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D1B.R5');
    });

    it('Path: Q1=N/PN/NI -> Q4=Y/PY -> CRIT (terminal)', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'N',
          d1b_4: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D1B.R6');
    });

    it('Path: Q1=N/PN/NI -> Q4=N/PN/NI -> NC3=N/PN -> SER', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'PN',
          d1b_4: 'PN',
          d1b_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D1B.R8');
    });

    it('Path: Q1=N/PN/NI -> Q4=N/PN/NI -> NC3=Y/PY -> CRIT', () => {
      const result = scoreRobinsDomain(
        'domain1b',
        answers({
          d1b_1: 'N',
          d1b_4: 'NI',
          d1b_5: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D1B.R7');
    });
  });

  describe('Domain 2 (Classification of Interventions)', () => {
    it('returns null for incomplete answers (missing Q1)', () => {
      const result = scoreRobinsDomain('domain2', {});
      expect(result.judgement).toBeNull();
      expect(result.isComplete).toBe(false);
    });

    it('Path: A1=Y/PY -> C1=N/PN -> E1=N/PN -> LOW', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'Y',
          d2_4: 'N',
          d2_5: 'PN',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D2.R1');
    });

    it('Path: A1=Y/PY -> C1=N/PN -> E1=Y/PY/NI -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'PY',
          d2_4: 'PN',
          d2_5: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D2.R2');
    });

    it('Path: A1=Y/PY -> C1=WY/NI -> E2=N/PN -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'Y',
          d2_4: 'WY',
          d2_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D2.R3');
    });

    it('Path: A1=Y/PY -> C1=SY -> E3=N/PN -> SER', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'PY',
          d2_4: 'SY',
          d2_5: 'PN',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D2.R4');
    });

    it('Path: A1=Y/PY -> C1=SY -> E3=Y/PY/NI -> CRIT', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'Y',
          d2_4: 'SY',
          d2_5: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D2.R4');
    });

    it('Path: A1=N/PN/NI -> A2=Y/PY -> C1=N/PN -> E1=N/PN -> LOW', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'N',
          d2_2: 'Y',
          d2_4: 'PN',
          d2_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D2.R5');
    });

    it('Path: A1=N/PN/NI -> A2=N/PN/NI -> A3=WY/NI -> C2=N/PN -> E2=N/PN -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'PN',
          d2_2: 'PN',
          d2_3: 'WY',
          d2_4: 'N',
          d2_5: 'PN',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D2.R6');
    });

    it('treats SY like WY for 2.3 (A3=SY takes the C2 path)', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'PN',
          d2_2: 'PN',
          d2_3: 'SY',
          d2_4: 'N',
          d2_5: 'PN',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D2.R6');
    });

    it('Path: A1=N/PN/NI -> A2=N/PN/NI -> A3=N/PN -> C3=SY/WY/NI -> CRIT (terminal)', () => {
      const result = scoreRobinsDomain(
        'domain2',
        answers({
          d2_1: 'N',
          d2_2: 'NI',
          d2_3: 'N',
          d2_4: 'WY',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D2.R7');
    });
  });

  describe('Domain 3 (Selection Bias - Multi-step)', () => {
    it('returns null when Part A incomplete', () => {
      const result = scoreRobinsDomain('domain3', answers({ d3_1: 'Y' }));
      expect(result.judgement).toBeNull();
      expect(result.isComplete).toBe(false);
    });

    it('Path: All LOW -> LOW (terminal, no correction questions)', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          d3_1: 'Y',
          d3_2: 'N',
          d3_3: 'N',
          d3_4: 'N',
          d3_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D3.R1');
    });

    it('Path: At worst MODERATE -> MOD (terminal, no correction questions)', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          d3_1: 'Y',
          d3_2: 'Y',
          d3_3: 'N',
          d3_4: 'N',
          d3_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D3.R2');
    });

    it('Path: At least one SERIOUS -> C1=Y/PY -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          d3_1: 'SN',
          d3_2: 'N',
          d3_3: 'N',
          d3_4: 'N',
          d3_5: 'N',
          d3_6: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D3.R3');
    });

    it('Path: At least one SERIOUS -> C1=N/PN/NI -> C2=Y/PY -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          d3_1: 'SN',
          d3_2: 'N',
          d3_3: 'N',
          d3_4: 'N',
          d3_5: 'N',
          d3_6: 'N',
          d3_7: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D3.R3');
    });

    it('Path: At least one SERIOUS -> C1=N/PN/NI -> C2=N/PN/NI -> C3=N/PN/NI -> SER', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          d3_1: 'SN',
          d3_2: 'N',
          d3_3: 'N',
          d3_4: 'N',
          d3_5: 'N',
          d3_6: 'PN',
          d3_7: 'N',
          d3_8: 'NI',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D3.R4');
    });

    it('Path: At least one SERIOUS -> C1=N/PN/NI -> C2=N/PN/NI -> C3=Y/PY -> CRIT', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          d3_1: 'Y',
          d3_2: 'N',
          d3_3: 'Y',
          d3_4: 'Y',
          d3_5: 'Y',
          d3_6: 'N',
          d3_7: 'PN',
          d3_8: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D3.R5');
    });

    it('Path: Part A WN/NI -> MOD, Part B N/PN -> LOW -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          d3_1: 'WN',
          d3_2: 'N',
          d3_3: 'N',
          d3_4: 'N',
          d3_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D3.R2');
    });

    it('Path: Part A SN -> SER, Part B N/PN -> LOW -> SER (needs correction)', () => {
      const result = scoreRobinsDomain(
        'domain3',
        answers({
          d3_1: 'SN',
          d3_2: 'N',
          d3_3: 'N',
          d3_4: 'N',
          d3_5: 'N',
          d3_6: 'N',
          d3_7: 'N',
          d3_8: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D3.R4');
    });
  });

  describe('Domain 4 (Missing Data)', () => {
    it('returns null when 4.1-4.3 incomplete', () => {
      const result = scoreRobinsDomain('domain4', answers({ d4_1: 'Y' }));
      expect(result.judgement).toBeNull();
      expect(result.isComplete).toBe(false);
    });

    it('Path: All Y/PY complete data -> LOW (terminal)', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'Y',
          d4_2: 'PY',
          d4_3: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D4.R1');
    });

    it('Path: Missing data -> B=Y/PY/NI -> C=N/PN -> LOW', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'N',
          d4_2: 'Y',
          d4_3: 'Y',
          d4_4: 'Y',
          d4_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D4.R2');
    });

    it('treats NA like NI so scoring does not get stuck (4.4=NA behaves like 4.4=NI)', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'N',
          d4_2: 'Y',
          d4_3: 'Y',
          d4_4: 'NA',
          d4_5: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D4.R2');
    });

    it('Path: Missing data -> B=Y/PY/NI -> C=Y/PY/NI -> E=Y/PY -> F1=Y/PY -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'N',
          d4_2: 'Y',
          d4_3: 'Y',
          d4_4: 'Y',
          d4_5: 'Y',
          d4_6: 'Y',
          d4_11: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D4.R3');
    });

    it('Path: Missing data -> B=Y/PY/NI -> C=Y/PY/NI -> E=Y/PY -> F1=N/PN -> SER', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'N',
          d4_2: 'Y',
          d4_3: 'Y',
          d4_4: 'NI',
          d4_5: 'Y',
          d4_6: 'PY',
          d4_11: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D4.R4');
    });

    it('Path: Missing data -> B=N/PN -> D=Y/PY -> G=Y/PY -> I=Y/PY -> LOW', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'PN',
          d4_2: 'Y',
          d4_3: 'Y',
          d4_4: 'N',
          d4_7: 'Y',
          d4_8: 'Y',
          d4_9: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D4.R5');
    });

    it('Path: Missing data -> B=N/PN -> D=Y/PY -> G=Y/PY -> I=WN/NI -> F2=Y/PY -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'N',
          d4_2: 'Y',
          d4_3: 'Y',
          d4_4: 'N',
          d4_7: 'Y',
          d4_8: 'Y',
          d4_9: 'WN',
          d4_11: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D4.R6');
    });

    it('Path: Missing data -> B=N/PN -> D=N/PN/NI -> H=Y/PY -> LOW', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'N',
          d4_2: 'N',
          d4_3: 'N',
          d4_4: 'N',
          d4_7: 'N',
          d4_10: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D4.R2');
    });

    it('Path: Missing data -> B=N/PN -> D=N/PN/NI -> H=SN -> F3=N/PN -> CRIT', () => {
      const result = scoreRobinsDomain(
        'domain4',
        answers({
          d4_1: 'N',
          d4_2: 'N',
          d4_3: 'N',
          d4_4: 'N',
          d4_7: 'NI',
          d4_10: 'SN',
          d4_11: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
      expect(result.ruleId).toBe('D4.R8');
    });
  });

  describe('Domain 5 (Measurement of Outcome)', () => {
    it('returns null for incomplete answers (missing Q1)', () => {
      const result = scoreRobinsDomain('domain5', {});
      expect(result.judgement).toBeNull();
      expect(result.isComplete).toBe(false);
    });

    it('Path: Q1=Y/PY -> SER (terminal, no Q2/Q3 needed)', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D5.R1');
    });

    it('Path: Q1=N/PN -> Q2a=N/PN -> LOW (terminal, no Q3 needed)', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'N',
          d5_2: 'PN',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D5.R2');
    });

    it('Path: Q1=N/PN -> Q2a=Y/PY/NI -> Q3a=N/PN -> LOW', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'PN',
          d5_2: 'Y',
          d5_3: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D5.R3');
    });

    it('Path: Q1=N/PN -> Q2a=Y/PY/NI -> Q3a=WY/NI -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'N',
          d5_2: 'PY',
          d5_3: 'WY',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D5.R4');
    });

    it('Path: Q1=N/PN -> Q2a=Y/PY/NI -> Q3a=SY -> SER', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'PN',
          d5_2: 'Y',
          d5_3: 'SY',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D5.R5');
    });

    it('Path: Q1=NI -> Q2b=N/PN -> MOD (terminal, no Q3 needed)', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'NI',
          d5_2: 'N',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D5.R6');
    });

    it('Path: Q1=NI -> Q2b=Y/PY/NI -> Q3b=WY/N/PN/NI -> MOD', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'NI',
          d5_2: 'Y',
          d5_3: 'WY',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.MODERATE);
      expect(result.ruleId).toBe('D5.R7');
    });

    it('Path: Q1=NI -> Q2b=Y/PY/NI -> Q3b=SY -> SER', () => {
      const result = scoreRobinsDomain(
        'domain5',
        answers({
          d5_1: 'NI',
          d5_2: 'PY',
          d5_3: 'SY',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
      expect(result.ruleId).toBe('D5.R7');
    });
  });

  describe('Domain 6 (Selection of Reported Result)', () => {
    it('returns null for incomplete answers (missing Q1)', () => {
      const result = scoreRobinsDomain('domain6', {});
      expect(result.judgement).toBeNull();
      expect(result.isComplete).toBe(false);
    });

    it('Path: Q1=Y/PY -> LOW (terminal, no selection questions needed)', () => {
      const result = scoreRobinsDomain(
        'domain6',
        answers({
          d6_1: 'Y',
        }),
      );
      expect(result.judgement).toBe(JUDGEMENTS.LOW);
      expect(result.ruleId).toBe('D6.R1');
    });

    it('Path: Q1=N/PN/NI -> SEL: All N/PN -> LOW', () => {
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

    it('Path: Q1=N/PN/NI -> SEL: At least one NI, but none Y/PY -> MOD', () => {
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

    it('Path: Q1=N/PN/NI -> SEL: One Y/PY -> SER', () => {
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

    it('Path: Q1=N/PN/NI -> SEL: All NI -> SER', () => {
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
      expect(result.ruleId).toBe('D6.R4');
    });

    it('Path: Q1=N/PN/NI -> SEL: Two or more Y/PY -> CRIT', () => {
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

  it('uses domain1a for ITT (isPerProtocol=false)', () => {
    const checklistState = {
      sectionC: { isPerProtocol: false },
      domain1a: { answers: answers({ d1a_1: 'Y', d1a_2: 'Y', d1a_3: 'N', d1a_4: 'N' }) },
      domain1b: { answers: {} },
      domain2: { answers: answers({ d2_1: 'Y', d2_4: 'N', d2_5: 'N' }) },
      domain3: { answers: answers({ d3_1: 'Y', d3_2: 'N', d3_3: 'N', d3_4: 'N', d3_5: 'N' }) },
      domain4: { answers: answers({ d4_1: 'Y', d4_2: 'Y', d4_3: 'Y' }) },
      domain5: { answers: answers({ d5_1: 'N', d5_2: 'N' }) },
      domain6: { answers: answers({ d6_1: 'Y' }) },
    };
    const result = scoreAllDomains(checklistState);
    expect(result.isComplete).toBe(true);
    expect(result.domains.domain1a).toBeDefined();
    expect(result.domains.domain1b).toBeUndefined();
  });

  it('uses domain1b for per-protocol (isPerProtocol=true)', () => {
    const checklistState = {
      sectionC: { isPerProtocol: true },
      domain1a: { answers: {} },
      domain1b: { answers: answers({ d1b_1: 'Y', d1b_2: 'Y', d1b_3: 'Y', d1b_5: 'N' }) },
      domain2: { answers: answers({ d2_1: 'Y', d2_4: 'N', d2_5: 'N' }) },
      domain3: { answers: answers({ d3_1: 'Y', d3_2: 'N', d3_3: 'N', d3_4: 'N', d3_5: 'N' }) },
      domain4: { answers: answers({ d4_1: 'Y', d4_2: 'Y', d4_3: 'Y' }) },
      domain5: { answers: answers({ d5_1: 'N', d5_2: 'N' }) },
      domain6: { answers: answers({ d6_1: 'Y' }) },
    };
    const result = scoreAllDomains(checklistState);
    expect(result.isComplete).toBe(true);
    expect(result.domains.domain1a).toBeUndefined();
    expect(result.domains.domain1b).toBeDefined();
  });

  it('calculates overall as max severity across domains', () => {
    const checklistState = {
      sectionC: { isPerProtocol: false },
      domain1a: { answers: answers({ d1a_1: 'Y', d1a_2: 'Y', d1a_3: 'N', d1a_4: 'N' }) }, // LOW_EX
      domain2: { answers: answers({ d2_1: 'Y', d2_4: 'N', d2_5: 'N' }) }, // LOW
      domain3: { answers: answers({ d3_1: 'Y', d3_2: 'N', d3_3: 'N', d3_4: 'N', d3_5: 'N' }) }, // LOW
      domain4: { answers: answers({ d4_1: 'Y', d4_2: 'Y', d4_3: 'Y' }) }, // LOW
      domain5: { answers: answers({ d5_1: 'N', d5_2: 'N' }) }, // LOW
      domain6: { answers: answers({ d6_1: 'Y' }) }, // LOW
    };
    const result = scoreAllDomains(checklistState);
    expect(result.isComplete).toBe(true);
    expect(result.overall).toBe(JUDGEMENTS.LOW);
  });

  it('calculates overall as CRITICAL when any domain is CRITICAL', () => {
    const checklistState = {
      sectionC: { isPerProtocol: false },
      domain1a: { answers: answers({ d1a_1: 'Y', d1a_2: 'Y', d1a_3: 'N', d1a_4: 'N' }) }, // LOW_EX
      domain2: { answers: answers({ d2_1: 'Y', d2_4: 'N', d2_5: 'N' }) }, // LOW
      domain3: { answers: answers({ d3_1: 'Y', d3_2: 'N', d3_3: 'N', d3_4: 'N', d3_5: 'N' }) }, // LOW
      domain4: { answers: answers({ d4_1: 'Y', d4_2: 'Y', d4_3: 'Y' }) }, // LOW
      domain5: { answers: answers({ d5_1: 'N', d5_2: 'N' }) }, // LOW
      domain6: { answers: answers({ d6_1: 'N', d6_2: 'Y', d6_3: 'Y', d6_4: 'N' }) }, // CRITICAL
    };
    const result = scoreAllDomains(checklistState);
    expect(result.isComplete).toBe(true);
    expect(result.overall).toBe(JUDGEMENTS.CRITICAL);
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
