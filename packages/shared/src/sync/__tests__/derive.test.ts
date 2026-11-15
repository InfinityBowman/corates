import { describe, expect, it } from 'vitest';
import { defaultAnswerRows } from '../answer-rows.js';
import { deriveFinalized, scoreChecklistRows } from '../derive.js';

describe('ROBINS-I Section B early stop', () => {
  it.each([
    ['sectionB.b2', 'Y'],
    ['sectionB.b2', 'PY'],
    ['sectionB.b3', 'Y'],
    ['sectionB.b3', 'PY'],
  ])('scores Critical when %s is %s, with the domains left unanswered', (key, answer) => {
    const flat = { ...defaultAnswerRows('ROBINS_I'), [key]: answer };

    expect(scoreChecklistRows('ROBINS_I', flat)).toBe('Critical');
    expect(deriveFinalized('ROBINS_I', flat).consolidatedAnswers?.overall).toBe('Critical');
  });

  it('stays Incomplete when Section B does not stop the assessment', () => {
    const flat = { ...defaultAnswerRows('ROBINS_I'), 'sectionB.b2': 'N', 'sectionB.b3': 'PN' };

    expect(scoreChecklistRows('ROBINS_I', flat)).toBe('Incomplete');
  });
});
