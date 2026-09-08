import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { resetTestDatabase } from '../../__tests__/helpers';
import { createAuth } from '../config';
import { AUTH_RATE_LIMIT, RATE_LIMITED_AUTH_PATHS } from '../rate-limit';
import type { Env } from '../../types';

const OTP_PATH = '/email-otp/send-verification-otp';
const OTP_RULE = AUTH_RATE_LIMIT.customRules[OTP_PATH];

// A fresh instance per request stands in for separate Workers isolates, so
// the test only passes if the counter lives in D1 rather than in memory.
function sendOtp(ip: string, headers: Record<string, string> = {}) {
  const auth = createAuth({ ...env, AUTH_SECRET: 'test-secret-that-is-long-enough' } as Env);
  return auth.handler(
    new Request(`http://localhost:8787/api/auth${OTP_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3010',
        'cf-connecting-ip': ip,
        ...headers,
      },
      body: JSON.stringify({ email: 'limited@example.com', type: 'sign-in' }),
    }),
  );
}

async function statuses(ip: string, n: number): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((await sendOtp(ip)).status);
  return out;
}

describe('auth rate limiting', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // customRules match exact paths, so a renamed or removed endpoint would
  // silently fall back to the defaults
  it('lists only paths Better Auth actually serves', () => {
    const auth = createAuth({ ...env, AUTH_SECRET: 'test-secret-that-is-long-enough' } as Env);
    const served = new Set(Object.values(auth.api).map(endpoint => endpoint.path));
    for (const path of RATE_LIMITED_AUTH_PATHS) expect(served).toContain(path);
  });

  it('returns 429 with a retry hint once one IP exceeds the OTP send limit', async () => {
    const results = await statuses('203.0.113.10', 20);
    expect(results.filter(s => s === 200)).toHaveLength(OTP_RULE.max);
    expect(results.slice(OTP_RULE.max).every(s => s === 429)).toBe(true);

    const blocked = await sendOtp('203.0.113.10');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('X-Retry-After'))).toBeGreaterThan(0);
    expect(await blocked.json()).toMatchObject({ message: expect.stringMatching(/too many/i) });
  });

  it('keys the limit on cf-connecting-ip, not on a client-supplied x-forwarded-for', async () => {
    await statuses('203.0.113.10', OTP_RULE.max);
    expect((await sendOtp('203.0.113.10', { 'x-forwarded-for': '198.51.100.7' })).status).toBe(429);
    expect((await sendOtp('203.0.113.11')).status).toBe(200);
  });

  it('lets the IP through again after the window passes', async () => {
    await statuses('203.0.113.10', OTP_RULE.max);
    expect((await sendOtp('203.0.113.10')).status).toBe(429);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + (OTP_RULE.window + 1) * 1000);
    expect((await sendOtp('203.0.113.10')).status).toBe(200);
  });
});
