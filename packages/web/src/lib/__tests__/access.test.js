/**
 * Tests for access.js
 *
 * Tests time-based access checking for subscriptions.
 * Uses currentPeriodEnd (Unix timestamp in seconds) and status field.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hasActiveAccess, isAccessExpired } from '../access.js';

describe('access', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set to Jan 6, 2026 12:00:00 UTC (timestamp in seconds: 1736164800)
    vi.setSystemTime(new Date('2026-01-06T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hasActiveAccess', () => {
    it('returns false for null subscription', () => {
      expect(hasActiveAccess(null)).toBe(false);
    });

    it('returns false for undefined subscription', () => {
      expect(hasActiveAccess(undefined)).toBe(false);
    });

    it('returns false for inactive status', () => {
      const subscription = {
        status: 'canceled',
        currentPeriodEnd: 1736251200, // Future timestamp
      };
      expect(hasActiveAccess(subscription)).toBe(false);
    });

    it('returns false for paused status', () => {
      const subscription = {
        status: 'paused',
        currentPeriodEnd: 1736251200,
      };
      expect(hasActiveAccess(subscription)).toBe(false);
    });

    it('returns true for active subscription with no expiration', () => {
      const subscription = {
        status: 'active',
        currentPeriodEnd: null,
      };
      expect(hasActiveAccess(subscription)).toBe(true);
    });

    it('returns true for active subscription with undefined expiration', () => {
      const subscription = {
        status: 'active',
      };
      expect(hasActiveAccess(subscription)).toBe(true);
    });

    it('returns true for active subscription with future expiration', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'active',
        currentPeriodEnd: nowSeconds + 86400, // 24 hours from now
      };
      expect(hasActiveAccess(subscription)).toBe(true);
    });

    it('returns false for active subscription with past expiration', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'active',
        currentPeriodEnd: nowSeconds - 86400, // 24 hours ago
      };
      expect(hasActiveAccess(subscription)).toBe(false);
    });

    it('returns false when expiration equals current time (boundary)', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'active',
        currentPeriodEnd: nowSeconds, // Exactly now
      };
      expect(hasActiveAccess(subscription)).toBe(false);
    });

    it('returns true when expiration is 1 second in future', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'active',
        currentPeriodEnd: nowSeconds + 1, // 1 second from now
      };
      expect(hasActiveAccess(subscription)).toBe(true);
    });
  });

  describe('isAccessExpired', () => {
    it('returns true for null subscription', () => {
      expect(isAccessExpired(null)).toBe(true);
    });

    it('returns true for undefined subscription', () => {
      expect(isAccessExpired(undefined)).toBe(true);
    });

    it('returns true for inactive status', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'canceled',
        currentPeriodEnd: nowSeconds + 86400,
      };
      expect(isAccessExpired(subscription)).toBe(true);
    });

    it('returns false for active subscription with no expiration (never expires)', () => {
      const subscription = {
        status: 'active',
        currentPeriodEnd: null,
      };
      expect(isAccessExpired(subscription)).toBe(false);
    });

    it('returns false for active subscription with undefined expiration', () => {
      const subscription = {
        status: 'active',
      };
      expect(isAccessExpired(subscription)).toBe(false);
    });

    it('returns false for active subscription with future expiration', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'active',
        currentPeriodEnd: nowSeconds + 86400,
      };
      expect(isAccessExpired(subscription)).toBe(false);
    });

    it('returns true for active subscription with past expiration', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'active',
        currentPeriodEnd: nowSeconds - 86400,
      };
      expect(isAccessExpired(subscription)).toBe(true);
    });

    it('returns true when expiration equals current time (boundary)', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const subscription = {
        status: 'active',
        currentPeriodEnd: nowSeconds,
      };
      expect(isAccessExpired(subscription)).toBe(true);
    });

    it('is inverse of hasActiveAccess for valid subscriptions', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const activeWithFuture = {
        status: 'active',
        currentPeriodEnd: nowSeconds + 86400,
      };
      expect(isAccessExpired(activeWithFuture)).toBe(!hasActiveAccess(activeWithFuture));

      const activeWithPast = {
        status: 'active',
        currentPeriodEnd: nowSeconds - 86400,
      };
      expect(isAccessExpired(activeWithPast)).toBe(!hasActiveAccess(activeWithPast));

      const activeNoExpiry = { status: 'active' };
      expect(isAccessExpired(activeNoExpiry)).toBe(!hasActiveAccess(activeNoExpiry));
    });
  });

  describe('edge cases', () => {
    it('handles very far future dates', () => {
      const subscription = {
        status: 'active',
        currentPeriodEnd: 4102444800, // Jan 1, 2100
      };
      expect(hasActiveAccess(subscription)).toBe(true);
      expect(isAccessExpired(subscription)).toBe(false);
    });

    it('handles very old past dates', () => {
      const subscription = {
        status: 'active',
        currentPeriodEnd: 946684800, // Jan 1, 2000
      };
      expect(hasActiveAccess(subscription)).toBe(false);
      expect(isAccessExpired(subscription)).toBe(true);
    });

    it('handles empty object (no status field)', () => {
      const subscription = {};
      // No status means not active
      expect(hasActiveAccess(subscription)).toBe(false);
      expect(isAccessExpired(subscription)).toBe(true);
    });

    it('handles subscription with only status field', () => {
      const subscription = {
        status: 'active',
      };
      expect(hasActiveAccess(subscription)).toBe(true);
      expect(isAccessExpired(subscription)).toBe(false);
    });
  });
});
