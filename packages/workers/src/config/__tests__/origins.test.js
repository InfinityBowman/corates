/**
 * Tests for origin validation and CORS configuration
 */

import { describe, it, expect } from 'vitest';
import {
  STATIC_ORIGINS,
  matchesOriginPattern,
  getAllowedOrigins,
  isOriginAllowed,
  getAccessControlOrigin,
} from '../origins.js';

describe('matchesOriginPattern', () => {
  it('should match valid workers.dev preview URL', () => {
    const origin = 'https://abc123-corates.jacobamaynard.workers.dev';
    expect(matchesOriginPattern(origin)).toBe(true);
  });

  it('should match main workers.dev URL', () => {
    const origin = 'https://corates.jacobamaynard.workers.dev';
    expect(matchesOriginPattern(origin)).toBe(true);
  });

  it('should reject non-https workers.dev URLs', () => {
    const origin = 'http://abc123-corates.jacobamaynard.workers.dev';
    expect(matchesOriginPattern(origin)).toBe(false);
  });

  it('should reject invalid workers.dev subdomains', () => {
    const origin = 'https://INVALID_CHARS-corates.jacobamaynard.workers.dev';
    expect(matchesOriginPattern(origin)).toBe(false);
  });

  it('should reject completely different domains', () => {
    const origin = 'https://evil.com';
    expect(matchesOriginPattern(origin)).toBe(false);
  });

  it('should return false for null or undefined origin', () => {
    expect(matchesOriginPattern(null)).toBe(false);
    expect(matchesOriginPattern()).toBe(false);
    expect(matchesOriginPattern('')).toBe(false);
  });
});

describe('getAllowedOrigins', () => {
  it('should return static origins when no env provided', () => {
    const origins = getAllowedOrigins();

    expect(origins).toContain('http://localhost:5173');
    expect(origins).toContain('https://corates.org');
    expect(origins.length).toBe(STATIC_ORIGINS.length);
  });

  it('should include origins from ALLOWED_ORIGINS env var', () => {
    const env = { ALLOWED_ORIGINS: 'https://custom1.com, https://custom2.com' };
    const origins = getAllowedOrigins(env);

    expect(origins).toContain('https://custom1.com');
    expect(origins).toContain('https://custom2.com');
  });

  it('should trim whitespace from env origins', () => {
    const env = { ALLOWED_ORIGINS: '  https://custom.com  ' };
    const origins = getAllowedOrigins(env);

    expect(origins).toContain('https://custom.com');
  });

  it('should not duplicate origins', () => {
    const env = { ALLOWED_ORIGINS: 'http://localhost:5173' }; // Already in STATIC_ORIGINS
    const origins = getAllowedOrigins(env);

    const count = origins.filter(o => o === 'http://localhost:5173').length;
    expect(count).toBe(1);
  });

  it('should include AUTH_BASE_URL if provided', () => {
    const env = { AUTH_BASE_URL: 'https://auth.example.com' };
    const origins = getAllowedOrigins(env);

    expect(origins).toContain('https://auth.example.com');
  });

  it('should not duplicate AUTH_BASE_URL if already in list', () => {
    const env = {
      AUTH_BASE_URL: 'https://custom.com',
      ALLOWED_ORIGINS: 'https://custom.com',
    };
    const origins = getAllowedOrigins(env);

    const count = origins.filter(o => o === 'https://custom.com').length;
    expect(count).toBe(1);
  });

  it('should ignore empty origins from env', () => {
    const env = { ALLOWED_ORIGINS: 'https://valid.com,  , https://another.com' };
    const origins = getAllowedOrigins(env);

    expect(origins).toContain('https://valid.com');
    expect(origins).toContain('https://another.com');
  });
});

describe('isOriginAllowed', () => {
  it('should allow static origins', () => {
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(isOriginAllowed('https://corates.org')).toBe(true);
    expect(isOriginAllowed('https://www.corates.org')).toBe(true);
  });

  it('should allow origins from env ALLOWED_ORIGINS', () => {
    const env = { ALLOWED_ORIGINS: 'https://custom.com' };
    expect(isOriginAllowed('https://custom.com', env)).toBe(true);
  });

  it('should allow origins matching patterns', () => {
    const origin = 'https://preview-corates.jacobamaynard.workers.dev';
    expect(isOriginAllowed(origin)).toBe(true);
  });

  it('should reject unknown origins', () => {
    expect(isOriginAllowed('https://evil.com')).toBe(false);
    expect(isOriginAllowed('http://unknown.local')).toBe(false);
  });

  it('should reject null or undefined origins', () => {
    expect(isOriginAllowed(null)).toBe(false);
    expect(isOriginAllowed()).toBe(false);
    expect(isOriginAllowed('')).toBe(false);
  });

  it('should handle env with AUTH_BASE_URL', () => {
    const env = { AUTH_BASE_URL: 'https://auth.custom.com' };
    expect(isOriginAllowed('https://auth.custom.com', env)).toBe(true);
  });
});

describe('getAccessControlOrigin', () => {
  it('should return the request origin if allowed', () => {
    const requestOrigin = 'https://corates.org';
    const result = getAccessControlOrigin(requestOrigin);

    expect(result).toBe('https://corates.org');
  });

  it('should return first static origin as fallback for unknown origins', () => {
    const requestOrigin = 'https://evil.com';
    const result = getAccessControlOrigin(requestOrigin);

    expect(result).toBe(STATIC_ORIGINS[0]);
  });

  it('should return allowed origin from env', () => {
    const env = { ALLOWED_ORIGINS: 'https://custom.com' };
    const requestOrigin = 'https://custom.com';
    const result = getAccessControlOrigin(requestOrigin, env);

    expect(result).toBe('https://custom.com');
  });

  it('should return matching pattern origin', () => {
    const requestOrigin = 'https://test-corates.jacobamaynard.workers.dev';
    const result = getAccessControlOrigin(requestOrigin);

    expect(result).toBe(requestOrigin);
  });

  it('should fallback for null origin', () => {
    const result = getAccessControlOrigin(null);
    expect(result).toBe(STATIC_ORIGINS[0]);
  });
});
