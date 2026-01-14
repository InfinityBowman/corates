/**
 * Tests for BillingResolver
 * Tests edge cases: multiple subscriptions, grant precedence, expired grants, plan validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedOrgMember,
  seedSubscription,
  seedProject,
} from '@/__tests__/helpers.js';
import { createDb } from '@/db/client.js';
import { createGrant } from '@/db/orgAccessGrants.js';
import {
  resolveOrgAccess,
  validatePlanChange,
  getOrgResourceUsage,
} from '@/lib/billingResolver.js';
import { isSubscriptionActive } from '@/lib/subscriptionStatus';

beforeEach(async () => {
  await resetTestDatabase();
});

/**
 * Helper to create standard test org setup
 */
async function createTestOrg(orgId = 'org-1', userId = 'user-1') {
  const nowSec = Math.floor(Date.now() / 1000);

  await seedUser({
    id: userId,
    name: 'User 1',
    email: 'user1@example.com',
    createdAt: nowSec,
    updatedAt: nowSec,
  });

  await seedOrganization({
    id: orgId,
    name: 'Test Org',
    slug: 'test-org',
    createdAt: nowSec,
  });

  await seedOrgMember({
    id: `member-${userId}`,
    userId,
    organizationId: orgId,
    role: 'owner',
    createdAt: nowSec,
  });

  return { nowSec, orgId, userId };
}

const billingOptions = { includeTrial: true, includePastDue: true };

describe('isSubscriptionActive', () => {
  it('should return false for null subscription', () => {
    expect(isSubscriptionActive(null, Date.now(), billingOptions)).toBe(false);
  });

  it('should return true for trialing subscription', () => {
    const sub = { status: 'trialing' };
    expect(isSubscriptionActive(sub, Date.now(), billingOptions)).toBe(true);
  });

  it('should return true for active subscription', () => {
    const sub = { status: 'active', cancelAtPeriodEnd: false };
    expect(isSubscriptionActive(sub, Date.now(), billingOptions)).toBe(true);
  });

  it('should return true for active subscription with scheduled cancel before period end', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const sub = {
      status: 'active',
      cancelAtPeriodEnd: true,
      periodEnd: new Date((nowSec + 86400) * 1000), // Tomorrow
    };
    expect(isSubscriptionActive(sub, nowSec, billingOptions)).toBe(true);
  });

  it('should return false for active subscription with scheduled cancel after period end', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const sub = {
      status: 'active',
      cancelAtPeriodEnd: true,
      periodEnd: new Date((nowSec - 86400) * 1000), // Yesterday
    };
    expect(isSubscriptionActive(sub, nowSec, billingOptions)).toBe(false);
  });

  it('should return true for past_due within grace period', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const sub = {
      status: 'past_due',
      periodEnd: new Date((nowSec + 86400) * 1000), // Tomorrow
    };
    expect(isSubscriptionActive(sub, nowSec, billingOptions)).toBe(true);
  });

  it('should return false for past_due after grace period', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const sub = {
      status: 'past_due',
      periodEnd: new Date((nowSec - 86400) * 1000), // Yesterday
    };
    expect(isSubscriptionActive(sub, nowSec, billingOptions)).toBe(false);
  });

  it('should return false for canceled subscription', () => {
    const sub = { status: 'canceled' };
    expect(isSubscriptionActive(sub, Date.now(), billingOptions)).toBe(false);
  });

  it('should return false for paused subscription', () => {
    const sub = { status: 'paused' };
    expect(isSubscriptionActive(sub, Date.now(), billingOptions)).toBe(false);
  });

  it('should return false for unpaid subscription', () => {
    const sub = { status: 'unpaid' };
    expect(isSubscriptionActive(sub, Date.now(), billingOptions)).toBe(false);
  });

  it('should return false for incomplete subscription', () => {
    const sub = { status: 'incomplete' };
    expect(isSubscriptionActive(sub, Date.now(), billingOptions)).toBe(false);
  });

  it('should return false for incomplete_expired subscription', () => {
    const sub = { status: 'incomplete_expired' };
    expect(isSubscriptionActive(sub, Date.now(), billingOptions)).toBe(false);
  });
});

describe('resolveOrgAccess', () => {
  describe('free tier fallback', () => {
    it('should return free tier when no subscription or grants exist', async () => {
      const { orgId } = await createTestOrg();
      const db = createDb(env.DB);

      const result = await resolveOrgAccess(db, orgId);

      expect(result.effectivePlanId).toBe('free');
      expect(result.source).toBe('free');
      expect(result.accessMode).toBe('free');
      expect(result.entitlements['project.create']).toBe(false);
      expect(result.quotas['projects.max']).toBe(0);
      expect(result.subscription).toBeNull();
      expect(result.grant).toBeNull();
    });
  });

  describe('subscription precedence', () => {
    it('should use active subscription over grants', async () => {
      const { nowSec, orgId } = await createTestOrg();
      const db = createDb(env.DB);

      // Create active subscription
      await seedSubscription({
        id: 'sub-1',
        plan: 'team',
        referenceId: orgId,
        status: 'active',
        createdAt: nowSec,
        updatedAt: nowSec,
        periodStart: nowSec,
        periodEnd: nowSec + 86400 * 30,
      });

      // Create active trial grant (should be ignored)
      await createGrant(db, {
        id: 'grant-1',
        orgId,
        type: 'trial',
        startsAt: new Date(nowSec * 1000),
        expiresAt: new Date((nowSec + 86400 * 14) * 1000),
      });

      const result = await resolveOrgAccess(db, orgId);

      expect(result.effectivePlanId).toBe('team');
      expect(result.source).toBe('subscription');
      expect(result.accessMode).toBe('full');
      expect(result.subscription).not.toBeNull();
      expect(result.grant).toBeNull();
    });

    it('should handle multiple active subscriptions (invariant violation)', async () => {
      const { nowSec, orgId } = await createTestOrg();

      // Create two active subscriptions (should not happen in production)
      await seedSubscription({
        id: 'sub-1',
        plan: 'starter_team',
        referenceId: orgId,
        status: 'active',
        createdAt: nowSec - 100,
        updatedAt: nowSec - 100,
        periodStart: nowSec - 100,
        periodEnd: nowSec + 86400 * 20, // Shorter period
      });

      await seedSubscription({
        id: 'sub-2',
        plan: 'team',
        referenceId: orgId,
        status: 'active',
        createdAt: nowSec,
        updatedAt: nowSec,
        periodStart: nowSec,
        periodEnd: nowSec + 86400 * 30, // Longer period - should be selected
      });

      const db = createDb(env.DB);
      const result = await resolveOrgAccess(db, orgId);

      // Should pick the one with latest periodEnd
      expect(result.effectivePlanId).toBe('team');
      expect(result.source).toBe('subscription');
      expect(result.subscription.id).toBe('sub-2');
    });

    it('should use ended subscription for historical data, fall back to free', async () => {
      const { nowSec, orgId } = await createTestOrg();

      // Create ended subscription
      await seedSubscription({
        id: 'sub-1',
        plan: 'team',
        referenceId: orgId,
        status: 'canceled',
        createdAt: nowSec - 86400 * 60,
        updatedAt: nowSec - 86400 * 30,
        periodStart: nowSec - 86400 * 60,
        periodEnd: nowSec - 86400 * 30, // Ended 30 days ago
      });

      const db = createDb(env.DB);
      const result = await resolveOrgAccess(db, orgId);

      expect(result.effectivePlanId).toBe('free');
      expect(result.source).toBe('free');
    });
  });

  describe('grant precedence', () => {
    it('should use trial grant when no subscription exists', async () => {
      const { nowSec, orgId } = await createTestOrg();
      const db = createDb(env.DB);

      await createGrant(db, {
        id: 'grant-1',
        orgId,
        type: 'trial',
        startsAt: new Date(nowSec * 1000),
        expiresAt: new Date((nowSec + 86400 * 14) * 1000),
      });

      const result = await resolveOrgAccess(db, orgId);

      expect(result.effectivePlanId).toBe('trial');
      expect(result.source).toBe('grant');
      expect(result.accessMode).toBe('full');
      expect(result.grant.type).toBe('trial');
    });

    it('should prefer trial over single_project grant', async () => {
      const { nowSec, orgId } = await createTestOrg();
      const db = createDb(env.DB);

      // Create single_project grant first
      await createGrant(db, {
        id: 'grant-1',
        orgId,
        type: 'single_project',
        startsAt: new Date(nowSec * 1000),
        expiresAt: new Date((nowSec + 86400 * 365) * 1000), // 1 year
      });

      // Create trial grant
      await createGrant(db, {
        id: 'grant-2',
        orgId,
        type: 'trial',
        startsAt: new Date(nowSec * 1000),
        expiresAt: new Date((nowSec + 86400 * 14) * 1000), // 14 days
      });

      const result = await resolveOrgAccess(db, orgId);

      // Trial takes precedence over single_project
      expect(result.effectivePlanId).toBe('trial');
      expect(result.source).toBe('grant');
      expect(result.grant.type).toBe('trial');
    });

    it('should pick latest expiresAt when multiple grants of same type exist', async () => {
      const { nowSec, orgId } = await createTestOrg();
      const db = createDb(env.DB);

      // Create two trial grants with different expiry
      await createGrant(db, {
        id: 'grant-1',
        orgId,
        type: 'trial',
        startsAt: new Date(nowSec * 1000),
        expiresAt: new Date((nowSec + 86400 * 7) * 1000), // 7 days
      });

      await createGrant(db, {
        id: 'grant-2',
        orgId,
        type: 'trial',
        startsAt: new Date(nowSec * 1000),
        expiresAt: new Date((nowSec + 86400 * 14) * 1000), // 14 days - should be selected
      });

      const result = await resolveOrgAccess(db, orgId);

      expect(result.grant.id).toBe('grant-2');
    });

    it('should ignore grants not yet started', async () => {
      const { nowSec, orgId } = await createTestOrg();
      const db = createDb(env.DB);

      // Create grant that starts tomorrow
      await createGrant(db, {
        id: 'grant-1',
        orgId,
        type: 'trial',
        startsAt: new Date((nowSec + 86400) * 1000), // Tomorrow
        expiresAt: new Date((nowSec + 86400 * 15) * 1000),
      });

      const result = await resolveOrgAccess(db, orgId);

      expect(result.effectivePlanId).toBe('free');
      expect(result.source).toBe('free');
      expect(result.grant).toBeNull();
    });

    it('should ignore revoked grants', async () => {
      const { nowSec, orgId } = await createTestOrg();
      const db = createDb(env.DB);
      const { orgAccessGrants } = await import('@/db/schema.js');

      // Create grant and then revoke it
      await createGrant(db, {
        id: 'grant-1',
        orgId,
        type: 'trial',
        startsAt: new Date(nowSec * 1000),
        expiresAt: new Date((nowSec + 86400 * 14) * 1000),
      });

      // Revoke the grant
      const { eq } = await import('drizzle-orm');
      await db
        .update(orgAccessGrants)
        .set({ revokedAt: new Date() })
        .where(eq(orgAccessGrants.id, 'grant-1'));

      const result = await resolveOrgAccess(db, orgId);

      expect(result.effectivePlanId).toBe('free');
      expect(result.source).toBe('free');
    });
  });

  describe('expired grants (read-only access)', () => {
    it('should provide read-only access for expired grants', async () => {
      const { nowSec, orgId } = await createTestOrg();
      const db = createDb(env.DB);

      // Create expired grant
      await createGrant(db, {
        id: 'grant-1',
        orgId,
        type: 'trial',
        startsAt: new Date((nowSec - 86400 * 20) * 1000), // Started 20 days ago
        expiresAt: new Date((nowSec - 86400 * 6) * 1000), // Expired 6 days ago
      });

      const result = await resolveOrgAccess(db, orgId);

      expect(result.effectivePlanId).toBe('trial');
      expect(result.source).toBe('grant');
      expect(result.accessMode).toBe('readOnly');
      expect(result.grant.type).toBe('trial');
    });

    it('should use latest expired grant when multiple exist', async () => {
      const { nowSec, orgId } = await createTestOrg();
      const db = createDb(env.DB);

      // Create two expired grants
      await createGrant(db, {
        id: 'grant-1',
        orgId,
        type: 'trial',
        startsAt: new Date((nowSec - 86400 * 30) * 1000),
        expiresAt: new Date((nowSec - 86400 * 16) * 1000), // Expired 16 days ago
      });

      await createGrant(db, {
        id: 'grant-2',
        orgId,
        type: 'single_project',
        startsAt: new Date((nowSec - 86400 * 20) * 1000),
        expiresAt: new Date((nowSec - 86400 * 6) * 1000), // Expired 6 days ago - more recent
      });

      const result = await resolveOrgAccess(db, orgId);

      // Should use the most recently expired grant
      expect(result.grant.id).toBe('grant-2');
      expect(result.accessMode).toBe('readOnly');
    });
  });
});

describe('getOrgResourceUsage', () => {
  it('should return zero counts for org with no resources', async () => {
    const { orgId } = await createTestOrg();
    const db = createDb(env.DB);

    const usage = await getOrgResourceUsage(db, orgId);

    expect(usage.projects).toBe(0);
    expect(usage.collaborators).toBe(0);
  });

  it('should count projects correctly', async () => {
    const { nowSec, orgId, userId } = await createTestOrg();
    const db = createDb(env.DB);

    // Create some projects
    await seedProject({
      id: 'project-1',
      name: 'Project 1',
      orgId,
      createdBy: userId,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-2',
      name: 'Project 2',
      orgId,
      createdBy: userId,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const usage = await getOrgResourceUsage(db, orgId);

    expect(usage.projects).toBe(2);
  });

  it('should count collaborators correctly (excluding owner)', async () => {
    const { nowSec, orgId } = await createTestOrg('org-1', 'owner-1');
    const db = createDb(env.DB);

    // Add more members (collaborators)
    await seedUser({
      id: 'member-1',
      name: 'Member 1',
      email: 'member1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrgMember({
      id: 'membership-2',
      userId: 'member-1',
      organizationId: orgId,
      role: 'member',
      createdAt: nowSec,
    });

    await seedUser({
      id: 'admin-1',
      name: 'Admin 1',
      email: 'admin1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrgMember({
      id: 'membership-3',
      userId: 'admin-1',
      organizationId: orgId,
      role: 'admin',
      createdAt: nowSec,
    });

    const usage = await getOrgResourceUsage(db, orgId);

    // Should count member and admin, but not owner
    expect(usage.collaborators).toBe(2);
  });
});

describe('validatePlanChange', () => {
  it('should allow downgrade when usage is within limits', async () => {
    const { nowSec, orgId, userId } = await createTestOrg();
    const db = createDb(env.DB);

    // Create 2 projects (within starter_team limit of 3)
    await seedProject({
      id: 'project-1',
      name: 'Project 1',
      orgId,
      createdBy: userId,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-2',
      name: 'Project 2',
      orgId,
      createdBy: userId,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const result = await validatePlanChange(db, orgId, 'starter_team');

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.usage.projects).toBe(2);
  });

  it('should block downgrade when projects exceed limit', async () => {
    const { nowSec, orgId, userId } = await createTestOrg();
    const db = createDb(env.DB);

    // Create 5 projects (exceeds starter_team limit of 3)
    for (let i = 1; i <= 5; i++) {
      await seedProject({
        id: `project-${i}`,
        name: `Project ${i}`,
        orgId,
        createdBy: userId,
        createdAt: nowSec,
        updatedAt: nowSec,
      });
    }

    const result = await validatePlanChange(db, orgId, 'starter_team');

    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].quotaKey).toBe('projects.max');
    expect(result.violations[0].used).toBe(5);
    expect(result.violations[0].limit).toBe(3);
    expect(result.violations[0].message).toContain('2 project(s) before downgrading');
  });

  it('should block downgrade when collaborators exceed limit', async () => {
    const { nowSec, orgId } = await createTestOrg('org-1', 'owner-1');
    const db = createDb(env.DB);

    // Add 6 members (exceeds starter_team limit of 5 collaborators)
    for (let i = 1; i <= 6; i++) {
      await seedUser({
        id: `member-${i}`,
        name: `Member ${i}`,
        email: `member${i}@example.com`,
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedOrgMember({
        id: `membership-${i}`,
        userId: `member-${i}`,
        organizationId: orgId,
        role: 'member',
        createdAt: nowSec,
      });
    }

    const result = await validatePlanChange(db, orgId, 'starter_team');

    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.quotaKey === 'collaborators.org.max')).toBe(true);

    const collabViolation = result.violations.find(v => v.quotaKey === 'collaborators.org.max');
    expect(collabViolation.used).toBe(6);
    expect(collabViolation.limit).toBe(5);
  });

  it('should report multiple violations when both quotas exceeded', async () => {
    const { nowSec, orgId, userId } = await createTestOrg('org-1', 'owner-1');
    const db = createDb(env.DB);

    // Create 5 projects (exceeds starter_team limit of 3)
    for (let i = 1; i <= 5; i++) {
      await seedProject({
        id: `project-${i}`,
        name: `Project ${i}`,
        orgId,
        createdBy: userId,
        createdAt: nowSec,
        updatedAt: nowSec,
      });
    }

    // Add 7 collaborators (exceeds starter_team limit of 5)
    for (let i = 1; i <= 7; i++) {
      await seedUser({
        id: `member-${i}`,
        name: `Member ${i}`,
        email: `member${i}@example.com`,
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedOrgMember({
        id: `membership-${i}`,
        userId: `member-${i}`,
        organizationId: orgId,
        role: 'member',
        createdAt: nowSec,
      });
    }

    const result = await validatePlanChange(db, orgId, 'starter_team');

    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(2);
    expect(result.violations.some(v => v.quotaKey === 'projects.max')).toBe(true);
    expect(result.violations.some(v => v.quotaKey === 'collaborators.org.max')).toBe(true);
  });

  it('should allow any usage for unlimited_team plan', async () => {
    const { nowSec, orgId, userId } = await createTestOrg('org-1', 'owner-1');
    const db = createDb(env.DB);

    // Create many projects
    for (let i = 1; i <= 20; i++) {
      await seedProject({
        id: `project-${i}`,
        name: `Project ${i}`,
        orgId,
        createdBy: userId,
        createdAt: nowSec,
        updatedAt: nowSec,
      });
    }

    // Add many collaborators
    for (let i = 1; i <= 50; i++) {
      await seedUser({
        id: `member-${i}`,
        name: `Member ${i}`,
        email: `member${i}@example.com`,
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedOrgMember({
        id: `membership-${i}`,
        userId: `member-${i}`,
        organizationId: orgId,
        role: 'member',
        createdAt: nowSec,
      });
    }

    const result = await validatePlanChange(db, orgId, 'unlimited_team');

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should block downgrade to free plan with any resources', async () => {
    const { nowSec, orgId, userId } = await createTestOrg();
    const db = createDb(env.DB);

    // Create just 1 project
    await seedProject({
      id: 'project-1',
      name: 'Project 1',
      orgId,
      createdBy: userId,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const result = await validatePlanChange(db, orgId, 'free');

    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.quotaKey === 'projects.max')).toBe(true);
  });

  it('should include target plan info in result', async () => {
    const { orgId } = await createTestOrg();
    const db = createDb(env.DB);

    const result = await validatePlanChange(db, orgId, 'team');

    expect(result.targetPlan.id).toBe('team');
    expect(result.targetPlan.name).toBe('Team');
    expect(result.targetPlan.quotas['projects.max']).toBe(10);
    expect(result.targetPlan.quotas['collaborators.org.max']).toBe(15);
  });
});
