import { describe, it, expect } from 'vitest';
import { getOnboardingStep, isSyntheticEmail, makeSyntheticEmail } from '../email';

describe('isSyntheticEmail', () => {
  it('matches only the placeholder domain', () => {
    expect(isSyntheticEmail(makeSyntheticEmail('0000-0001-2345-6789'))).toBe(true);
    expect(isSyntheticEmail('someone@example.org')).toBe(false);
    expect(isSyntheticEmail('support@orcid.org')).toBe(false);
  });
});

describe('getOnboardingStep', () => {
  it('requires a real verified email before the profile', () => {
    expect(getOnboardingStep({ email: makeSyntheticEmail('x'), emailVerified: false })).toBe(
      'email',
    );
    expect(getOnboardingStep({ email: 'a@b.org', emailVerified: false })).toBe('email');
    expect(
      getOnboardingStep({ email: 'a@b.org', emailVerified: true, profileCompletedAt: null }),
    ).toBe('profile');
    expect(
      getOnboardingStep({ email: 'a@b.org', emailVerified: true, profileCompletedAt: 1 }),
    ).toBeNull();
  });

  it('pulls placeholder users with a completed profile back to the email step', () => {
    expect(
      getOnboardingStep({
        email: makeSyntheticEmail('0000-0001-2345-6789'),
        emailVerified: false,
        profileCompletedAt: 1,
      }),
    ).toBe('email');
  });
});
