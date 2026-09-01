import { describe, expect, it } from 'vitest';
import { countAssignedStudies, getPreviousSetupStep, setupStepNumber } from '../setup-steps';

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

describe('countAssignedStudies', () => {
  it('counts studies with at least one reviewer', () => {
    const study = (reviewer1: string | null, reviewer2: string | null) =>
      ({ id: crypto.randomUUID(), reviewer1, reviewer2 }) as never;
    expect(countAssignedStudies([study('u1', null), study(null, 'u2'), study(null, null)])).toBe(2);
  });
});
