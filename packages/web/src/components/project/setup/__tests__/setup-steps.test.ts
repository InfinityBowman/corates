import { describe, expect, it } from 'vitest';
import { getPreviousSetupStep, setupStepNumber } from '../setup-steps';

describe('setup step navigation', () => {
  it('maps step numbers', () => {
    expect(setupStepNumber('studies')).toBe(1);
    expect(setupStepNumber('team')).toBe(2);
    expect(setupStepNumber('distribution')).toBe(3);
  });

  it('returns the previous step', () => {
    expect(getPreviousSetupStep('team')).toBe('studies');
    expect(getPreviousSetupStep('distribution')).toBe('team');
    expect(getPreviousSetupStep('studies')).toBeNull();
  });
});
