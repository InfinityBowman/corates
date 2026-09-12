import { describe, it, expect } from 'vitest';
import {
  getOnboardingStep,
  isSyntheticEmail,
  isValidEmail,
  makeSyntheticEmail,
  normalizeEmail,
} from '../email';

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

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Someone@Example.ORG ')).toBe('someone@example.org');
  });

  it('strips invisible characters that survive trim', () => {
    // A word joiner pasted with the address made Postmark reject the send
    expect(normalizeEmail('\u2060someone@example.org')).toBe('someone@example.org');
    expect(normalizeEmail('some\u200bone@example.org')).toBe('someone@example.org');
    expect(normalizeEmail('someone@example.org\ufeff')).toBe('someone@example.org');
    expect(normalizeEmail('someone@exam\u00adple.org')).toBe('someone@example.org');
  });

  it('leaves a normalized address alone', () => {
    expect(normalizeEmail('someone@example.org')).toBe('someone@example.org');
  });
});

describe('isValidEmail', () => {
  it('accepts a normalized address and rejects junk', () => {
    expect(isValidEmail('someone@example.org')).toBe(true);
    expect(isValidEmail('someone')).toBe(false);
    expect(isValidEmail('someone@example')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});
