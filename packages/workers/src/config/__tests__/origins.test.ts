/**
 * Tests for origin validation and CORS configuration
 */

import { describe, it, expect } from 'vitest';
import {
  STATIC_ORIGINS,
  getAllowedOrigins,
  isOriginAllowed,
  getAccessControlOrigin,
} from '../origins.js';

describe('getAllowedOrigins', () => {
  it('returns the static origins list', () => {
    const origins = getAllowedOrigins();
    expect(origins).toEqual(STATIC_ORIGINS);
  });
});

describe('isOriginAllowed', () => {
  it('allows static origins', () => {
    expect(isOriginAllowed('http://localhost:3010')).toBe(true);
    expect(isOriginAllowed('https://corates.org')).toBe(true);
  });

  it('rejects unknown origins', () => {
    expect(isOriginAllowed('https://evil.com')).toBe(false);
    expect(isOriginAllowed('http://unknown.local')).toBe(false);
    expect(isOriginAllowed('http://localhost:5173')).toBe(false);
  });

  it('rejects null, undefined, or empty origins', () => {
    expect(isOriginAllowed(null)).toBe(false);
    expect(isOriginAllowed(undefined)).toBe(false);
    expect(isOriginAllowed('')).toBe(false);
  });
});

describe('getAccessControlOrigin', () => {
  it('returns the request origin if allowed', () => {
    expect(getAccessControlOrigin('https://corates.org')).toBe('https://corates.org');
    expect(getAccessControlOrigin('http://localhost:3010')).toBe('http://localhost:3010');
  });

  it('falls back to the first static origin for unknown origins', () => {
    expect(getAccessControlOrigin('https://evil.com')).toBe(STATIC_ORIGINS[0]);
  });

  it('falls back for null/undefined origins', () => {
    expect(getAccessControlOrigin(null)).toBe(STATIC_ORIGINS[0]);
    expect(getAccessControlOrigin(undefined)).toBe(STATIC_ORIGINS[0]);
  });
});
