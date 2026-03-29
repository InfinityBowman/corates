/**
 * Tests for subscription active status checking
 *
 * Tests time-based access checking for subscriptions.
 * Uses currentPeriodEnd (Unix timestamp in seconds) and status field.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isSubscriptionActive } from '../entitlements';

describe('isSubscriptionActive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set to Jan 6, 2026 12:00:00 UTC (timestamp in seconds: 1736164800)
    vi.setSystemTime(new Date('2026-01-06T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic status checks', () => {
    it('returns false for null subscription', () => {
      expect(isSubscriptionActive(null)).toBe(false);
    });

    it('returns false for undefined subscription', () => {
      expect(isSubscriptionActive(undefined)).toBe(false);
    });

    it('returns false for inactive status', () => {
      const subscription = {
        status: 'canceled',
        currentPeriodEnd: 1736251200,
      };
      expect(isSubscriptionActive(subscription)).toBe(false);
    });

    it('returns false for paused status', () => {
      const subscription = {
        status: 'paused',
        currentPeriodEnd: 1736251200,
      };
      expect(isSubscriptionActive(subscription)).toBe(false);
    });

    it('returns true for active subscription with no expiration', () => {
      const subscription = {
        status: 'active',
        currentPeriodEnd: null,
      };
      expect(isSubscriptionActive(subscription)).toBe(true);
    });

    it('returns true for active subscription with undefined expiration', () => {
      const subscription = {
        status: 'active',
      };
      expect(isSubscriptionActive(subscription)).toBe(true);
    });

    it('returns true for trialing subscription with future expiration', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'trialing',
        currentPeriodEnd: nowSeconds + 86400,
      };
      expect(isSubscriptionActive(subscription)).toBe(true);
    });

    it('returns true for past_due subscription with future expiration', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'past_due',
        currentPeriodEnd: nowSeconds + 86400,
      };
      expect(isSubscriptionActive(subscription)).toBe(true);
    });
  });

  describe('time-based checks', () => {
    it('returns true for active subscription with future expiration', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'active',
        currentPeriodEnd: nowSeconds + 86400,
      };
      expect(isSubscriptionActive(subscription)).toBe(true);
    });

    it('returns false for active subscription with past expiration', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'active',
        currentPeriodEnd: nowSeconds - 86400,
      };
      expect(isSubscriptionActive(subscription)).toBe(false);
    });

    it('returns false when expiration equals current time (boundary)', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'active',
        currentPeriodEnd: nowSeconds,
      };
      expect(isSubscriptionActive(subscription)).toBe(false);
    });

    it('returns true when expiration is 1 second in future', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'active',
        currentPeriodEnd: nowSeconds + 1,
      };
      expect(isSubscriptionActive(subscription)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles very far future dates', () => {
      const subscription = {
        status: 'active',
        currentPeriodEnd: 4102444800,
      };
      expect(isSubscriptionActive(subscription)).toBe(true);
    });

    it('handles very old past dates', () => {
      const subscription = {
        status: 'active',
        currentPeriodEnd: 946684800,
      };
      expect(isSubscriptionActive(subscription)).toBe(false);
    });

    it('handles empty object (no status field)', () => {
      expect(isSubscriptionActive({})).toBe(false);
    });

    it('handles subscription with only status field', () => {
      expect(isSubscriptionActive({ status: 'active' })).toBe(true);
    });
  });
});
