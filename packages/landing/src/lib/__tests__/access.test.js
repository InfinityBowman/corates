/**
 * Tests for access.js
 *
 * Tests time-based access checking for subscriptions.
 * Uses currentPeriodEnd (Unix timestamp in seconds) and status field.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hasActiveAccess } from '../access';

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

  describe('edge cases', () => {
    it('handles very far future dates', () => {
      const subscription = {
        status: 'active',
        currentPeriodEnd: 4102444800, // Jan 1, 2100
      };
      expect(hasActiveAccess(subscription)).toBe(true);
    });

    it('handles very old past dates', () => {
      const subscription = {
        status: 'active',
        currentPeriodEnd: 946684800, // Jan 1, 2000
      };
      expect(hasActiveAccess(subscription)).toBe(false);
    });

    it('handles empty object (no status field)', () => {
      expect(hasActiveAccess({})).toBe(false);
    });

    it('handles subscription with only status field', () => {
      expect(hasActiveAccess({ status: 'active' })).toBe(true);
    });
  });
});
