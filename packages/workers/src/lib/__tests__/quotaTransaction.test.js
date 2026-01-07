/**
 * Tests for transactional quota enforcement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedOrgMember,
  seedSubscription,
} from '@/__tests__/helpers.js';
import { createDb } from '@/db/client.js';
import { projects } from '@/db/schema.js';
import {
  checkQuotaForInsert,
  insertWithQuotaCheck,
  checkCollaboratorQuota,
} from '@/lib/quotaTransaction.js';

beforeEach(async () => {
  await resetTestDatabase();
});

describe('checkQuotaForInsert', () => {
  it('should allow insert when under quota', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';
    const userId = 'user-1';

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
      id: 'member-1',
      userId,
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    // Create subscription with 3 project limit
    await seedSubscription({
      id: 'sub-1',
      plan: 'starter_team',
      referenceId: orgId,
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
      periodStart: nowSec,
      periodEnd: nowSec + 86400 * 30,
    });

    const db = createDb(env.DB);
    const result = await checkQuotaForInsert(db, orgId, 'projects.max', projects, projects.orgId);

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.limit).toBe(3);
  });

  it('should block insert when at quota limit', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';
    const userId = 'user-1';

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
      id: 'member-1',
      userId,
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    // Create subscription with 3 project limit
    await seedSubscription({
      id: 'sub-1',
      plan: 'starter_team',
      referenceId: orgId,
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
      periodStart: nowSec,
      periodEnd: nowSec + 86400 * 30,
    });

    // Create 3 projects (at limit)
    const db = createDb(env.DB);
    for (let i = 0; i < 3; i++) {
      await db.insert(projects).values({
        id: `project-${i}`,
        name: `Project ${i}`,
        orgId,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const result = await checkQuotaForInsert(db, orgId, 'projects.max', projects, projects.orgId);

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(3);
    expect(result.limit).toBe(3);
    expect(result.error).toBeDefined();
    expect(result.error.code).toMatch(/AUTH_FORBIDDEN/);
  });

  it('should allow unlimited quota', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';
    const userId = 'user-1';

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
      id: 'member-1',
      userId,
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    // Create unlimited subscription
    await seedSubscription({
      id: 'sub-1',
      plan: 'unlimited_team',
      referenceId: orgId,
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
      periodStart: nowSec,
      periodEnd: nowSec + 86400 * 30,
    });

    const db = createDb(env.DB);
    const result = await checkQuotaForInsert(db, orgId, 'projects.max', projects, projects.orgId);

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
  });
});

describe('insertWithQuotaCheck', () => {
  it('should execute inserts when quota allows', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';
    const userId = 'user-1';

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
      id: 'member-1',
      userId,
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      plan: 'starter_team',
      referenceId: orgId,
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
      periodStart: nowSec,
      periodEnd: nowSec + 86400 * 30,
    });

    const db = createDb(env.DB);

    const result = await insertWithQuotaCheck(db, {
      orgId,
      quotaKey: 'projects.max',
      countTable: projects,
      countColumn: projects.orgId,
      insertStatements: [
        db.insert(projects).values({
          id: 'new-project',
          name: 'New Project',
          orgId,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ],
    });

    expect(result.success).toBe(true);

    // Verify project was created
    const { eq } = await import('drizzle-orm');
    const createdProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, 'new-project'))
      .get();

    expect(createdProject).toBeDefined();
    expect(createdProject.name).toBe('New Project');
  });

  it('should reject insert when quota exceeded', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';
    const userId = 'user-1';

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
      id: 'member-1',
      userId,
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      plan: 'starter_team',
      referenceId: orgId,
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
      periodStart: nowSec,
      periodEnd: nowSec + 86400 * 30,
    });

    const db = createDb(env.DB);

    // Create 3 projects (at limit)
    for (let i = 0; i < 3; i++) {
      await db.insert(projects).values({
        id: `project-${i}`,
        name: `Project ${i}`,
        orgId,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const result = await insertWithQuotaCheck(db, {
      orgId,
      quotaKey: 'projects.max',
      countTable: projects,
      countColumn: projects.orgId,
      insertStatements: [
        db.insert(projects).values({
          id: 'over-limit-project',
          name: 'Over Limit Project',
          orgId,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    // Verify project was NOT created
    const { eq } = await import('drizzle-orm');
    const notCreated = await db
      .select()
      .from(projects)
      .where(eq(projects.id, 'over-limit-project'))
      .get();

    expect(notCreated).toBeUndefined();
  });
});

describe('checkCollaboratorQuota', () => {
  it('should count non-owner members correctly', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    // Create owner
    await seedUser({
      id: 'owner-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrgMember({
      id: 'member-owner',
      userId: 'owner-1',
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    // Create 2 regular members
    for (let i = 0; i < 2; i++) {
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

    await seedSubscription({
      id: 'sub-1',
      plan: 'starter_team', // 5 collaborators limit
      referenceId: orgId,
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
      periodStart: nowSec,
      periodEnd: nowSec + 86400 * 30,
    });

    const db = createDb(env.DB);
    const result = await checkCollaboratorQuota(db, orgId);

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(2); // Only non-owners counted
    expect(result.limit).toBe(5);
  });

  it('should block when collaborator limit reached', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1';

    await seedOrganization({
      id: orgId,
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    // Create owner
    await seedUser({
      id: 'owner-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrgMember({
      id: 'member-owner',
      userId: 'owner-1',
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    // Create 5 regular members (at limit for starter_team)
    for (let i = 0; i < 5; i++) {
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

    await seedSubscription({
      id: 'sub-1',
      plan: 'starter_team', // 5 collaborators limit
      referenceId: orgId,
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
      periodStart: nowSec,
      periodEnd: nowSec + 86400 * 30,
    });

    const db = createDb(env.DB);
    const result = await checkCollaboratorQuota(db, orgId);

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(5);
    expect(result.limit).toBe(5);
    expect(result.error).toBeDefined();
  });
});
