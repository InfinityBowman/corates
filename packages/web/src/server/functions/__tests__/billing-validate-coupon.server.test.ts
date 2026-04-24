import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { resetCounter } from '@/__tests__/server/factories';
import { validateCoupon } from '@/server/functions/billing.server';

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
});

describe('validateCoupon', () => {
  it('returns invalid when code is empty', async () => {
    const result = await validateCoupon('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it('returns invalid when stripe is not configured', async () => {
    stripeConfigured = false;
    const result = await validateCoupon('PROMO50');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not available/i);
  });

  it('returns invalid for unknown promo code', async () => {
    promoCodesListMock.mockResolvedValueOnce({ data: [] });
    const result = await validateCoupon('NOPE');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid|expired/i);
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
    const result = await validateCoupon('SAVE50');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.promoCodeId).toBe('promo_1');
      expect(result.code).toBe('SAVE50');
      expect(result.percentOff).toBe(50);
      expect(result.duration).toBe('once');
    }
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
    const result = await validateCoupon('OLD');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });
});
