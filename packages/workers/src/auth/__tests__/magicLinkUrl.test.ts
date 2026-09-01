import { describe, it, expect } from 'vitest';
import { buildMagicLinkInterstitialUrl } from '../magicLinkUrl';

describe('buildMagicLinkInterstitialUrl', () => {
  it('links to /verify-link on the callbackURL origin', () => {
    const verifyUrl =
      'https://corates.org/api/auth/magic-link/verify?token=abc123&callbackURL=' +
      encodeURIComponent('https://corates.org/complete-profile');

    const result = new URL(buildMagicLinkInterstitialUrl(verifyUrl, 'abc123'));

    expect(result.origin).toBe('https://corates.org');
    expect(result.pathname).toBe('/verify-link');
    expect(result.searchParams.get('token')).toBe('abc123');
    expect(result.searchParams.get('callbackURL')).toBe('https://corates.org/complete-profile');
  });

  it('uses the frontend origin from callbackURL in local dev', () => {
    const verifyUrl =
      'http://localhost:8787/api/auth/magic-link/verify?token=abc123&callbackURL=' +
      encodeURIComponent('http://localhost:3010/complete-profile');

    const result = new URL(buildMagicLinkInterstitialUrl(verifyUrl, 'abc123'));

    expect(result.origin).toBe('http://localhost:3010');
    expect(result.pathname).toBe('/verify-link');
  });

  it('falls back to the auth origin for a relative callbackURL', () => {
    const verifyUrl =
      'https://corates.org/api/auth/magic-link/verify?token=abc123&callbackURL=%2Fdashboard';

    const result = new URL(buildMagicLinkInterstitialUrl(verifyUrl, 'abc123'));

    expect(result.origin).toBe('https://corates.org');
    expect(result.searchParams.get('callbackURL')).toBe('/dashboard');
  });

  it('falls back to the auth origin when callbackURL is missing', () => {
    const verifyUrl = 'https://corates.org/api/auth/magic-link/verify?token=abc123';

    const result = new URL(buildMagicLinkInterstitialUrl(verifyUrl, 'abc123'));

    expect(result.origin).toBe('https://corates.org');
    expect(result.searchParams.get('callbackURL')).toBe('/');
  });
});
