/**
 * Tests for transactional quota enforcement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedOrgMember,
  seedSubscription,
} from '../../__tests__/helpers.js';
import { createDb } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import type { OrgId } from '@corates/shared/ids';
import { insertWithQuotaCheck } from '../quotaTransaction.js';

beforeEach(async () => {
  await resetTestDatabase();
});

describe('insertWithQuotaCheck', () => {
  it('should execute inserts when quota allows', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1' as OrgId;
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
      plan: 'team',
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
    expect(createdProject!.name).toBe('New Project');
  });

  it('should reject insert when quota exceeded', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const orgId = 'org-1' as OrgId;
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
      plan: 'team',
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
