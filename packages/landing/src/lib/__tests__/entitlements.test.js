/**
 * Tests for entitlements.ts
 *
 * Tests subscription status checking, entitlement resolution, and quota checking.
 * Asserts against actual plan values from @corates/shared/plans.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSubscriptionActive,
  getEffectiveEntitlements,
  getEffectiveQuotas,
  hasEntitlement,
  hasQuota,
} from '../entitlements';

describe('entitlements', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-06T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Fake time is 2026-01-06T12:00:00Z = epoch 1767700800
  const futureEnd = 1767700800 + 86400; // 1 day in the future
  const pastEnd = 1767700800 - 86400; // 1 day in the past

  describe('isSubscriptionActive', () => {
    it('returns false for null subscription', () => {
      expect(isSubscriptionActive(null)).toBe(false);
    });

    it('returns false for undefined subscription', () => {
      expect(isSubscriptionActive(undefined)).toBe(false);
    });

    it('returns true for active status with future expiration', () => {
      expect(isSubscriptionActive({ status: 'active', currentPeriodEnd: futureEnd })).toBe(true);
    });

    it('returns true for trialing status with future expiration', () => {
      expect(isSubscriptionActive({ status: 'trialing', currentPeriodEnd: futureEnd })).toBe(true);
    });

    it('returns true for past_due status with future expiration', () => {
      expect(isSubscriptionActive({ status: 'past_due', currentPeriodEnd: futureEnd })).toBe(true);
    });

    it('returns false for canceled status', () => {
      expect(isSubscriptionActive({ status: 'canceled', currentPeriodEnd: futureEnd })).toBe(false);
    });

    it('returns false for paused status', () => {
      expect(isSubscriptionActive({ status: 'paused', currentPeriodEnd: futureEnd })).toBe(false);
    });

    it('returns true for active with no expiration (null)', () => {
      expect(isSubscriptionActive({ status: 'active', currentPeriodEnd: null })).toBe(true);
    });

    it('returns true for active with no expiration (undefined)', () => {
      expect(isSubscriptionActive({ status: 'active' })).toBe(true);
    });

    it('returns false for active with past expiration', () => {
      expect(isSubscriptionActive({ status: 'active', currentPeriodEnd: pastEnd })).toBe(false);
    });

    it('returns false at exact expiration boundary', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      expect(isSubscriptionActive({ status: 'active', currentPeriodEnd: nowSeconds })).toBe(false);
    });

    it('returns true 1 second before expiration', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      expect(isSubscriptionActive({ status: 'active', currentPeriodEnd: nowSeconds + 1 })).toBe(true);
    });

    it('handles string timestamp conversion', () => {
      expect(isSubscriptionActive({ status: 'active', currentPeriodEnd: String(futureEnd) })).toBe(true);
      expect(isSubscriptionActive({ status: 'active', currentPeriodEnd: String(pastEnd) })).toBe(false);
    });
  });

  describe('getEffectiveEntitlements', () => {
    it('returns free plan entitlements for null subscription', () => {
      const entitlements = getEffectiveEntitlements(null);
      expect(entitlements['project.create']).toBe(false);
    });

    it('returns free plan entitlements for expired subscription', () => {
      const entitlements = getEffectiveEntitlements({ status: 'active', tier: 'team', currentPeriodEnd: pastEnd });
      expect(entitlements['project.create']).toBe(false);
    });

    it('returns team plan entitlements for active team subscription', () => {
      const entitlements = getEffectiveEntitlements({ status: 'active', tier: 'team', currentPeriodEnd: futureEnd });
      expect(entitlements['project.create']).toBe(true);
    });

    it('returns free plan for canceled subscription even with future end', () => {
      const entitlements = getEffectiveEntitlements({ status: 'canceled', tier: 'team', currentPeriodEnd: futureEnd });
      expect(entitlements['project.create']).toBe(false);
    });

    it('returns entitlements for trialing subscription', () => {
      const entitlements = getEffectiveEntitlements({ status: 'trialing', tier: 'starter_team', currentPeriodEnd: futureEnd });
      expect(entitlements['project.create']).toBe(true);
    });
  });

  describe('getEffectiveQuotas', () => {
    it('returns free plan quotas for null subscription', () => {
      const quotas = getEffectiveQuotas(null);
      expect(quotas['projects.max']).toBe(0);
      expect(quotas['collaborators.org.max']).toBe(0);
    });

    it('returns team plan quotas for active team subscription', () => {
      const quotas = getEffectiveQuotas({ status: 'active', tier: 'team', currentPeriodEnd: futureEnd });
      expect(quotas['projects.max']).toBe(10);
      expect(quotas['collaborators.org.max']).toBe(15);
    });

    it('returns unlimited quotas for unlimited_team plan', () => {
      const quotas = getEffectiveQuotas({ status: 'active', tier: 'unlimited_team', currentPeriodEnd: futureEnd });
      expect(quotas['projects.max']).toBe(-1);
      expect(quotas['collaborators.org.max']).toBe(-1);
    });

    it('returns free plan quotas for expired subscription', () => {
      const quotas = getEffectiveQuotas({ status: 'active', tier: 'team', currentPeriodEnd: pastEnd });
      expect(quotas['projects.max']).toBe(0);
    });
  });

  describe('hasEntitlement', () => {
    it('returns true for team subscription with project.create', () => {
      expect(hasEntitlement({ status: 'active', tier: 'team', currentPeriodEnd: futureEnd }, 'project.create')).toBe(true);
    });

    it('returns false for free plan with project.create', () => {
      expect(hasEntitlement(null, 'project.create')).toBe(false);
    });

    it('returns false for nonexistent entitlement', () => {
      expect(hasEntitlement({ status: 'active', tier: 'team', currentPeriodEnd: futureEnd }, 'nonexistent')).toBe(false);
    });
  });

  describe('hasQuota', () => {
    it('returns false for free plan creating a project', () => {
      expect(hasQuota(null, 'projects.max', { used: 0, requested: 1 })).toBe(false);
    });

    it('returns true for team plan under quota', () => {
      const sub = { status: 'active', tier: 'team', currentPeriodEnd: futureEnd };
      expect(hasQuota(sub, 'projects.max', { used: 5, requested: 1 })).toBe(true);
    });

    it('returns false for team plan at quota limit', () => {
      const sub = { status: 'active', tier: 'team', currentPeriodEnd: futureEnd };
      expect(hasQuota(sub, 'projects.max', { used: 10, requested: 1 })).toBe(false);
    });

    it('returns true for unlimited plan regardless of usage', () => {
      const sub = { status: 'active', tier: 'unlimited_team', currentPeriodEnd: futureEnd };
      expect(hasQuota(sub, 'projects.max', { used: 9999, requested: 1 })).toBe(true);
    });

    it('defaults requested to 1', () => {
      const sub = { status: 'active', tier: 'team', currentPeriodEnd: futureEnd };
      expect(hasQuota(sub, 'projects.max', { used: 9 })).toBe(true);
      expect(hasQuota(sub, 'projects.max', { used: 10 })).toBe(false);
    });
  });
});
