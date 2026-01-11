import { describe, it, expect } from 'vitest';
import {
  createROB2Checklist,
  scoreROB2Checklist,
  isROB2Complete,
  getAnswers,
  scoreRob2Domain,
  scoreAllDomains,
  JUDGEMENTS,
} from '../rob2/index.js';

// Helper to create answers object
function makeAnswers(answerMap: Record<string, string | null>) {
  const result: Record<string, { answer: string | null; comment: string }> = {};
  for (const [key, value] of Object.entries(answerMap)) {
    result[key] = { answer: value, comment: '' };
  }
  return result;
}

describe('ROB-2', () => {
  describe('createROB2Checklist', () => {
    it('should create a checklist with all required fields', () => {
      const checklist = createROB2Checklist({
        name: 'Test Checklist',
        id: 'test-123',
        reviewerName: 'Alice',
      });

      expect(checklist.name).toBe('Test Checklist');
      expect(checklist.id).toBe('test-123');
      expect(checklist.reviewerName).toBe('Alice');
      expect(checklist.type).toBe('ROB2');
      expect(checklist.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Check preliminary section exists
      expect(checklist.preliminary).toBeDefined();
      expect(checklist.preliminary.aim).toBe(null);

      // Check all domains exist
      expect(checklist.domain1).toBeDefined();
      expect(checklist.domain2a).toBeDefined();
      expect(checklist.domain2b).toBeDefined();
      expect(checklist.domain3).toBeDefined();
      expect(checklist.domain4).toBeDefined();
      expect(checklist.domain5).toBeDefined();

      // Check overall section exists
      expect(checklist.overall).toBeDefined();
    });

    it('should throw if id is missing', () => {
      expect(() =>
        createROB2Checklist({
          name: 'Test',
          id: '',
        }),
      ).toThrow('non-empty string id');
    });

    it('should throw if name is missing', () => {
      expect(() =>
        createROB2Checklist({
          name: '',
          id: 'test-123',
        }),
      ).toThrow('non-empty string name');
    });

    it('should initialize domains with empty answers', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      // Domain 1 should have questions d1_1, d1_2, d1_3
      expect(checklist.domain1.answers.d1_1).toEqual({ answer: null, comment: '' });
      expect(checklist.domain1.answers.d1_2).toEqual({ answer: null, comment: '' });
      expect(checklist.domain1.answers.d1_3).toEqual({ answer: null, comment: '' });

      // Domain 5 should have questions d5_1, d5_2, d5_3
      expect(checklist.domain5.answers.d5_1).toEqual({ answer: null, comment: '' });
      expect(checklist.domain5.answers.d5_3).toEqual({ answer: null, comment: '' });
    });
  });

  describe('scoreRob2Domain', () => {
    describe('Domain 1 (Randomization)', () => {
      it('should return null for incomplete answers', () => {
        const answers = makeAnswers({ d1_1: null, d1_2: null, d1_3: null });
        const result = scoreRob2Domain('domain1', answers);
        expect(result.judgement).toBe(null);
        expect(result.isComplete).toBe(false);
      });

      it('should return High when concealment (1.2) is N/PN [D1.R1]', () => {
        const answers = makeAnswers({ d1_1: 'Y', d1_2: 'N', d1_3: 'N' });
        const result = scoreRob2Domain('domain1', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D1.R1');
      });

      it('should return Some concerns when concealment Y but random sequence N [D1.R2]', () => {
        const answers = makeAnswers({ d1_1: 'N', d1_2: 'Y', d1_3: 'N' });
        const result = scoreRob2Domain('domain1', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D1.R2');
      });

      it('should return Low when Y/Y/N path (all good) [D1.R3]', () => {
        const answers = makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' });
        const result = scoreRob2Domain('domain1', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D1.R3');
      });

      it('should return Low when PY/PY/PN path [D1.R3]', () => {
        const answers = makeAnswers({ d1_1: 'PY', d1_2: 'PY', d1_3: 'PN' });
        const result = scoreRob2Domain('domain1', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
      });

      it('should return Low when random=NI but concealment=Y and no baseline imbalance [D1.R3]', () => {
        const answers = makeAnswers({ d1_1: 'NI', d1_2: 'Y', d1_3: 'N' });
        const result = scoreRob2Domain('domain1', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
      });

      it('should return Some concerns when baseline imbalances Y [D1.R4]', () => {
        const answers = makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'Y' });
        const result = scoreRob2Domain('domain1', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D1.R4');
      });

      it('should return Some concerns when concealment NI and no baseline imbalance [D1.R5]', () => {
        const answers = makeAnswers({ d1_1: 'Y', d1_2: 'NI', d1_3: 'N' });
        const result = scoreRob2Domain('domain1', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D1.R5');
      });

      it('should return High when concealment NI and baseline imbalance Y [D1.R6]', () => {
        const answers = makeAnswers({ d1_1: 'Y', d1_2: 'NI', d1_3: 'Y' });
        const result = scoreRob2Domain('domain1', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D1.R6');
      });

      it('should treat NA as NI for scoring', () => {
        const answers = makeAnswers({ d1_1: 'NA', d1_2: 'Y', d1_3: 'N' });
        const result = scoreRob2Domain('domain1', answers);
        // NA normalized to NI, so d1_1=NI, d1_2=Y -> goes to 1.3 which is N -> Low
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
      });
    });

    describe('Domain 2a (Effect of assignment - ITT)', () => {
      it('should return null for incomplete answers', () => {
        const answers = makeAnswers({ d2a_1: null, d2a_2: null });
        const result = scoreRob2Domain('domain2a', answers);
        expect(result.judgement).toBe(null);
        expect(result.isComplete).toBe(false);
      });

      it('should return Low when both participants and personnel not aware (Part 1) and analysis appropriate (Part 2)', () => {
        const answers = makeAnswers({
          d2a_1: 'N',
          d2a_2: 'N',
          d2a_3: null,
          d2a_4: null,
          d2a_5: null,
          d2a_6: 'Y',
          d2a_7: null,
        });
        const result = scoreRob2Domain('domain2a', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
      });

      it('should return Some concerns when deviations arise but no impact on outcome', () => {
        const answers = makeAnswers({
          d2a_1: 'Y',
          d2a_2: 'Y',
          d2a_3: 'Y',
          d2a_4: 'N',
          d2a_5: null,
          d2a_6: 'Y',
          d2a_7: null,
        });
        const result = scoreRob2Domain('domain2a', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
      });

      it('should return High when deviations affect outcome and are not balanced', () => {
        const answers = makeAnswers({
          d2a_1: 'Y',
          d2a_2: 'Y',
          d2a_3: 'Y',
          d2a_4: 'Y',
          d2a_5: 'N',
          d2a_6: 'Y',
          d2a_7: null,
        });
        const result = scoreRob2Domain('domain2a', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
      });

      it('should take worst rating between Part 1 and Part 2', () => {
        // Part 1: Low (N/N path)
        // Part 2: High (N/Y path)
        const answers = makeAnswers({
          d2a_1: 'N',
          d2a_2: 'N',
          d2a_3: null,
          d2a_4: null,
          d2a_5: null,
          d2a_6: 'N',
          d2a_7: 'Y',
        });
        const result = scoreRob2Domain('domain2a', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
      });

      it('should return Some concerns for Part 2 when no substantial impact', () => {
        const answers = makeAnswers({
          d2a_1: 'N',
          d2a_2: 'N',
          d2a_3: null,
          d2a_4: null,
          d2a_5: null,
          d2a_6: 'N',
          d2a_7: 'N',
        });
        const result = scoreRob2Domain('domain2a', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
      });
    });

    describe('Domain 2b (Effect of adhering - per-protocol)', () => {
      it('should return null for incomplete answers', () => {
        const answers = makeAnswers({ d2b_1: null, d2b_2: null });
        const result = scoreRob2Domain('domain2b', answers);
        expect(result.judgement).toBe(null);
        expect(result.isComplete).toBe(false);
      });

      it('should return Low when not aware and no failures/non-adherence [D2B.R1]', () => {
        const answers = makeAnswers({
          d2b_1: 'N',
          d2b_2: 'N',
          d2b_3: null,
          d2b_4: 'N',
          d2b_5: 'N',
          d2b_6: null,
        });
        const result = scoreRob2Domain('domain2b', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D2B.R1');
      });

      it('should return Some concerns when aware, balanced, no issues, but appropriate analysis [D2B.R5]', () => {
        const answers = makeAnswers({
          d2b_1: 'Y',
          d2b_2: 'Y',
          d2b_3: 'Y',
          d2b_4: 'Y',
          d2b_5: 'N',
          d2b_6: 'Y',
        });
        const result = scoreRob2Domain('domain2b', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
      });

      it('should return High when issues exist but no appropriate analysis [D2B.R6]', () => {
        const answers = makeAnswers({
          d2b_1: 'Y',
          d2b_2: 'Y',
          d2b_3: 'Y',
          d2b_4: 'Y',
          d2b_5: 'N',
          d2b_6: 'N',
        });
        const result = scoreRob2Domain('domain2b', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
      });

      it('should return High when not balanced and no appropriate analysis [D2B.R8]', () => {
        const answers = makeAnswers({
          d2b_1: 'Y',
          d2b_2: 'Y',
          d2b_3: 'N',
          d2b_4: null,
          d2b_5: null,
          d2b_6: 'N',
        });
        const result = scoreRob2Domain('domain2b', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D2B.R8');
      });
    });

    describe('Domain 3 (Missing outcome data)', () => {
      it('should return null for incomplete answers', () => {
        const answers = makeAnswers({ d3_1: null });
        const result = scoreRob2Domain('domain3', answers);
        expect(result.judgement).toBe(null);
        expect(result.isComplete).toBe(false);
      });

      it('should return Low when data available for all [D3.R1]', () => {
        const answers = makeAnswers({ d3_1: 'Y', d3_2: null, d3_3: null, d3_4: null });
        const result = scoreRob2Domain('domain3', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D3.R1');
      });

      it('should return Low when evidence not biased by missing data [D3.R2]', () => {
        const answers = makeAnswers({ d3_1: 'N', d3_2: 'Y', d3_3: null, d3_4: null });
        const result = scoreRob2Domain('domain3', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D3.R2');
      });

      it('should return Low when missingness could not depend on true value [D3.R3]', () => {
        const answers = makeAnswers({ d3_1: 'N', d3_2: 'N', d3_3: 'N', d3_4: null });
        const result = scoreRob2Domain('domain3', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D3.R3');
      });

      it('should return Some concerns when could depend but probably not [D3.R4]', () => {
        const answers = makeAnswers({ d3_1: 'N', d3_2: 'N', d3_3: 'Y', d3_4: 'N' });
        const result = scoreRob2Domain('domain3', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D3.R4');
      });

      it('should return High when missingness likely depended on true value [D3.R5]', () => {
        const answers = makeAnswers({ d3_1: 'N', d3_2: 'N', d3_3: 'Y', d3_4: 'Y' });
        const result = scoreRob2Domain('domain3', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D3.R5');
      });
    });

    describe('Domain 4 (Measurement of the outcome)', () => {
      it('should return null for incomplete answers', () => {
        const answers = makeAnswers({ d4_1: null });
        const result = scoreRob2Domain('domain4', answers);
        expect(result.judgement).toBe(null);
        expect(result.isComplete).toBe(false);
      });

      it('should return High when method inappropriate [D4.R1]', () => {
        const answers = makeAnswers({
          d4_1: 'Y',
          d4_2: null,
          d4_3: null,
          d4_4: null,
          d4_5: null,
        });
        const result = scoreRob2Domain('domain4', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D4.R1');
      });

      it('should return High when measurement differs between groups [D4.R2]', () => {
        const answers = makeAnswers({
          d4_1: 'N',
          d4_2: 'Y',
          d4_3: null,
          d4_4: null,
          d4_5: null,
        });
        const result = scoreRob2Domain('domain4', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D4.R2');
      });

      it('should return Low when assessors not aware [D4.R3]', () => {
        const answers = makeAnswers({
          d4_1: 'N',
          d4_2: 'N',
          d4_3: 'N',
          d4_4: null,
          d4_5: null,
        });
        const result = scoreRob2Domain('domain4', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D4.R3');
      });

      it('should return Low when aware but could not be influenced [D4.R4]', () => {
        const answers = makeAnswers({
          d4_1: 'N',
          d4_2: 'N',
          d4_3: 'Y',
          d4_4: 'N',
          d4_5: null,
        });
        const result = scoreRob2Domain('domain4', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D4.R4');
      });

      it('should return Some concerns when could be influenced but probably not [D4.R5]', () => {
        const answers = makeAnswers({
          d4_1: 'N',
          d4_2: 'N',
          d4_3: 'Y',
          d4_4: 'Y',
          d4_5: 'N',
        });
        const result = scoreRob2Domain('domain4', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D4.R5');
      });

      it('should return High when likely influenced [D4.R6]', () => {
        const answers = makeAnswers({
          d4_1: 'N',
          d4_2: 'N',
          d4_3: 'Y',
          d4_4: 'Y',
          d4_5: 'Y',
        });
        const result = scoreRob2Domain('domain4', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D4.R6');
      });

      it('should return Some concerns on NI branch when assessors not aware [D4.R7]', () => {
        const answers = makeAnswers({
          d4_1: 'N',
          d4_2: 'NI',
          d4_3: 'N',
          d4_4: null,
          d4_5: null,
        });
        const result = scoreRob2Domain('domain4', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D4.R7');
      });

      it('should return High on NI branch when likely influenced [D4.R10]', () => {
        const answers = makeAnswers({
          d4_1: 'N',
          d4_2: 'NI',
          d4_3: 'Y',
          d4_4: 'Y',
          d4_5: 'Y',
        });
        const result = scoreRob2Domain('domain4', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D4.R10');
      });
    });

    describe('Domain 5 (Selection of reported result)', () => {
      it('should return null for incomplete answers', () => {
        const answers = makeAnswers({ d5_1: null, d5_2: null, d5_3: null });
        const result = scoreRob2Domain('domain5', answers);
        expect(result.judgement).toBe(null);
        expect(result.isComplete).toBe(false);
      });

      it('should return High when selected from multiple measurements [D5.R1]', () => {
        const answers = makeAnswers({ d5_1: null, d5_2: 'Y', d5_3: 'N' });
        const result = scoreRob2Domain('domain5', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D5.R1');
      });

      it('should return High when selected from multiple analyses [D5.R1]', () => {
        const answers = makeAnswers({ d5_1: null, d5_2: 'N', d5_3: 'Y' });
        const result = scoreRob2Domain('domain5', answers);
        expect(result.judgement).toBe(JUDGEMENTS.HIGH);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D5.R1');
      });

      it('should return Some concerns when NI for selection questions [D5.R2]', () => {
        const answers = makeAnswers({ d5_1: null, d5_2: 'NI', d5_3: 'N' });
        const result = scoreRob2Domain('domain5', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D5.R2');
      });

      it('should return Low when pre-specified plan and no selection [D5.R3]', () => {
        const answers = makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' });
        const result = scoreRob2Domain('domain5', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D5.R3');
      });

      it('should return Some concerns when no pre-specified plan [D5.R4]', () => {
        const answers = makeAnswers({ d5_1: 'N', d5_2: 'N', d5_3: 'N' });
        const result = scoreRob2Domain('domain5', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D5.R4');
      });

      it('should return Some concerns when plan info is NI [D5.R4]', () => {
        const answers = makeAnswers({ d5_1: 'NI', d5_2: 'N', d5_3: 'N' });
        const result = scoreRob2Domain('domain5', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SOME_CONCERNS);
        expect(result.isComplete).toBe(true);
        expect(result.ruleId).toBe('D5.R4');
      });
    });

    describe('Unknown domain', () => {
      it('should return null for unknown domain key', () => {
        const answers = makeAnswers({ d1_1: 'Y' });
        const result = scoreRob2Domain('unknown', answers);
        expect(result.judgement).toBe(null);
        expect(result.isComplete).toBe(false);
      });
    });
  });

  describe('scoreAllDomains', () => {
    it('should return empty result for null state', () => {
      const result = scoreAllDomains(null);
      expect(result.domains).toEqual({});
      expect(result.overall).toBe(null);
      expect(result.isComplete).toBe(false);
    });

    it('should use domain2a for ASSIGNMENT aim', () => {
      const state = {
        preliminary: { aim: 'ASSIGNMENT' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' }) },
        domain2a: {
          answers: makeAnswers({
            d2a_1: 'N',
            d2a_2: 'N',
            d2a_6: 'Y',
          }),
        },
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.domains.domain2a).toBeDefined();
      expect(result.domains.domain2b).toBeUndefined();
    });

    it('should use domain2b for ADHERING aim', () => {
      const state = {
        preliminary: { aim: 'ADHERING' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' }) },
        domain2b: {
          answers: makeAnswers({
            d2b_1: 'N',
            d2b_2: 'N',
            d2b_4: 'N',
            d2b_5: 'N',
          }),
        },
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.domains.domain2b).toBeDefined();
      expect(result.domains.domain2a).toBeUndefined();
    });

    it('should return overall Low when all domains are Low', () => {
      const state = {
        preliminary: { aim: 'ASSIGNMENT' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' }) },
        domain2a: {
          answers: makeAnswers({
            d2a_1: 'N',
            d2a_2: 'N',
            d2a_6: 'Y',
          }),
        },
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.overall).toBe(JUDGEMENTS.LOW);
      expect(result.isComplete).toBe(true);
    });

    it('should return overall Some concerns when any domain has Some concerns', () => {
      const state = {
        preliminary: { aim: 'ASSIGNMENT' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'Y' }) }, // Some concerns
        domain2a: {
          answers: makeAnswers({
            d2a_1: 'N',
            d2a_2: 'N',
            d2a_6: 'Y',
          }),
        },
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.overall).toBe(JUDGEMENTS.SOME_CONCERNS);
      expect(result.isComplete).toBe(true);
    });

    it('should return overall High when any domain is High', () => {
      const state = {
        preliminary: { aim: 'ASSIGNMENT' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'N', d1_3: 'N' }) }, // High
        domain2a: {
          answers: makeAnswers({
            d2a_1: 'N',
            d2a_2: 'N',
            d2a_6: 'Y',
          }),
        },
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.overall).toBe(JUDGEMENTS.HIGH);
      expect(result.isComplete).toBe(true);
    });

    it('should return incomplete when not all domains are scored', () => {
      const state = {
        preliminary: { aim: 'ASSIGNMENT' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' }) },
        domain2a: { answers: makeAnswers({ d2a_1: null, d2a_2: null }) }, // Incomplete
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.overall).toBe(null);
      expect(result.isComplete).toBe(false);
    });
  });

  describe('scoreROB2Checklist', () => {
    it('should return Error for invalid input', () => {
      expect(scoreROB2Checklist(null as any)).toBe('Error');
      expect(scoreROB2Checklist(undefined as any)).toBe('Error');
      expect(scoreROB2Checklist('string' as any)).toBe('Error');
    });

    it('should return Incomplete when domains are not complete', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      expect(scoreROB2Checklist(checklist)).toBe('Incomplete');
    });

    it('should return Low when all domains score Low', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      checklist.preliminary.aim = 'ASSIGNMENT';
      checklist.domain1.answers = makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' });
      checklist.domain2a.answers = makeAnswers({
        d2a_1: 'N',
        d2a_2: 'N',
        d2a_6: 'Y',
      });
      checklist.domain3.answers = makeAnswers({ d3_1: 'Y' });
      checklist.domain4.answers = makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' });
      checklist.domain5.answers = makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' });

      expect(scoreROB2Checklist(checklist)).toBe('Low');
    });
  });

  describe('isROB2Complete', () => {
    it('should return false for empty checklist', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      expect(isROB2Complete(checklist)).toBe(false);
    });

    it('should return false when aim is not selected', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      // Fill in all answers but don't select aim
      checklist.domain1.answers = makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' });

      expect(isROB2Complete(checklist)).toBe(false);
    });

    it('should return true when all domains are complete', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      checklist.preliminary.aim = 'ASSIGNMENT';
      checklist.domain1.answers = makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' });
      checklist.domain2a.answers = makeAnswers({
        d2a_1: 'N',
        d2a_2: 'N',
        d2a_6: 'Y',
      });
      checklist.domain3.answers = makeAnswers({ d3_1: 'Y' });
      checklist.domain4.answers = makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' });
      checklist.domain5.answers = makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' });

      expect(isROB2Complete(checklist)).toBe(true);
    });
  });

  describe('getAnswers', () => {
    it('should return null for invalid input', () => {
      expect(getAnswers(null as any)).toBe(null);
    });

    it('should return structured answers object', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
        reviewerName: 'Alice',
      });

      const answers = getAnswers(checklist);
      expect(answers).not.toBe(null);
      expect(answers?.metadata.name).toBe('Test');
      expect(answers?.metadata.reviewerName).toBe('Alice');
      expect(answers?.preliminary).toBeDefined();
      expect(answers?.domains).toBeDefined();
      expect(answers?.overall).toBeDefined();
    });

    it('should include domain answers when filled', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      checklist.preliminary.aim = 'ASSIGNMENT';
      checklist.domain1.answers = makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' });

      const answers = getAnswers(checklist);
      expect(answers?.domains.domain1).toBeDefined();
      expect(answers?.domains.domain1.questions.d1_1).toBe('Y');
      expect(answers?.domains.domain1.questions.d1_2).toBe('Y');
      expect(answers?.domains.domain1.questions.d1_3).toBe('N');
    });
  });
});
