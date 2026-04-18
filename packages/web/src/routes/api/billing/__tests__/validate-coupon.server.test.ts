import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { resetCounter } from '@/__tests__/server/factories';
import { handlePost } from '../validate-coupon';

let sessionResult: {
  user: { id: string; email: string; name: string };
  session: { id: string; userId: string };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

const promoCodesListMock = vi.fn();
let stripeConfigured = true;

vi.mock('@corates/workers/stripe', () => ({
  isStripeConfigured: () => stripeConfigured,
  createStripeClient: () => ({
    promotionCodes: { list: (...args: unknown[]) => promoCodesListMock(...args) },
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
  stripeConfigured = true;
  sessionResult = {
    user: { id: 'user-1', email: 'u@example.com', name: 'U' },
    session: { id: 'sess-1', userId: 'user-1' },
  };
});

function couponReq(body: unknown): Request {
  return new Request('http://localhost/api/billing/validate-coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/billing/validate-coupon', () => {
  it('returns 401 when no session', async () => {
    sessionResult = null;
    const res = await handlePost({ request: couponReq({ code: 'X' }) });
    expect(res.status).toBe(401);
  });

  it('returns invalid when code is missing', async () => {
    const res = await handlePost({ request: couponReq({}) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { valid: boolean; error: string };
    expect(body.valid).toBe(false);
    expect(body.error).toMatch(/required/i);
  });

  it('returns invalid when stripe is not configured', async () => {
    stripeConfigured = false;
    const res = await handlePost({ request: couponReq({ code: 'PROMO50' }) });
    const body = (await res.json()) as { valid: boolean; error: string };
    expect(body.valid).toBe(false);
    expect(body.error).toMatch(/not available/i);
  });

  it('returns invalid for unknown promo code', async () => {
    promoCodesListMock.mockResolvedValueOnce({ data: [] });
    const res = await handlePost({ request: couponReq({ code: 'NOPE' }) });
    const body = (await res.json()) as { valid: boolean; error: string };
    expect(body.valid).toBe(false);
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it('returns details for a valid promo code', async () => {
    promoCodesListMock.mockResolvedValueOnce({
      data: [
        {
          id: 'promo_1',
          code: 'SAVE50',
          expires_at: null,
          max_redemptions: null,
          times_redeemed: 0,
          coupon: {
            percent_off: 50,
            amount_off: null,
            currency: null,
            duration: 'once',
            duration_in_months: null,
            name: 'Half off',
          },
        },
      ],
    });
    const res = await handlePost({ request: couponReq({ code: 'SAVE50' }) });
    const body = (await res.json()) as {
      valid: boolean;
      promoCodeId: string;
      code: string;
      percentOff: number | null;
      duration: string;
    };
    expect(body.valid).toBe(true);
    expect(body.promoCodeId).toBe('promo_1');
    expect(body.code).toBe('SAVE50');
    expect(body.percentOff).toBe(50);
    expect(body.duration).toBe('once');
  });

  it('returns expired when code is past expiry', async () => {
    const longAgo = Math.floor(Date.now() / 1000) - 10;
    promoCodesListMock.mockResolvedValueOnce({
      data: [
        {
          id: 'promo_1',
          code: 'OLD',
          expires_at: longAgo,
          max_redemptions: null,
          times_redeemed: 0,
          coupon: {},
        },
      ],
    });
    const res = await handlePost({ request: couponReq({ code: 'OLD' }) });
    const body = (await res.json()) as { valid: boolean; error: string };
    expect(body.valid).toBe(false);
    expect(body.error).toMatch(/expired/i);
  });
});
