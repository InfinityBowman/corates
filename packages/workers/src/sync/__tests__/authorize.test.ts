/**
 * buildSyncVerdict against real seeded D1 — the membership + entitlement
 * stamps every sync mutator will trust.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { orgAccessGrants } from '@corates/db/schema';
import { buildSyncVerdict } from '../authorize';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedProject,
  seedProjectMember,
  seedSubscription,
} from '../../__tests__/helpers';

const nowSec = Math.floor(Date.now() / 1000);
const ORG = 'org-sync-auth';
const PROJECT = 'project-sync-auth';
const USER = 'user-sync-auth';

async function seedBase(role: 'owner' | 'member' = 'member') {
  await seedUser({
    id: USER,
    name: 'Sync User',
    email: 'sync@example.com',
    createdAt: nowSec,
    updatedAt: nowSec,
  });
  await seedOrganization({ id: ORG, name: 'Sync Org', slug: `sync-org-${nowSec}`, createdAt: nowSec });
  await seedProject({
    id: PROJECT,
    name: 'Sync Project',
    orgId: ORG,
    createdBy: USER,
    createdAt: nowSec,
    updatedAt: nowSec,
  });
  await seedProjectMember({ id: 'pm-sync-1', projectId: PROJECT, userId: USER, role, joinedAt: nowSec });
}

describe('buildSyncVerdict', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('rejects an unknown project', async () => {
    const verdict = await buildSyncVerdict(createDb(env.DB), USER, 'no-such-project');
    expect(verdict).toEqual({ ok: false, reason: 'project-not-found' });
  });

  it('rejects a non-member', async () => {
    await seedBase();
    const verdict = await buildSyncVerdict(createDb(env.DB), 'someone-else', PROJECT);
    expect(verdict).toEqual({ ok: false, reason: 'not-a-member' });
  });

  it('stamps a free-tier member as writable (free passes the gate, matching requireOrgWriteAccess)', async () => {
    await seedBase('member');
    const verdict = await buildSyncVerdict(createDb(env.DB), USER, PROJECT);
    expect(verdict).toEqual({
      ok: true,
      principal: USER,
      context: { role: 'member', writeAllowed: true },
    });
  });

  it('stamps role owner for project owners', async () => {
    await seedBase('owner');
    const verdict = await buildSyncVerdict(createDb(env.DB), USER, PROJECT);
    expect(verdict.ok && verdict.context.role).toBe('owner');
  });

  it('stamps writeAllowed true under an active subscription', async () => {
    await seedBase();
    await seedSubscription({
      id: 'sub-sync-1',
      plan: 'team',
      referenceId: ORG,
      status: 'active',
      periodStart: nowSec - 1000,
      periodEnd: nowSec + 100_000,
      createdAt: nowSec,
      updatedAt: nowSec,
    });
    const verdict = await buildSyncVerdict(createDb(env.DB), USER, PROJECT);
    expect(verdict.ok && verdict.context.writeAllowed).toBe(true);
  });

  it('stamps writeAllowed false when the org sits on an expired grant (readOnly)', async () => {
    await seedBase();
    await createDb(env.DB)
      .insert(orgAccessGrants)
      .values({
        id: 'grant-sync-1' as never,
        orgId: ORG as never,
        type: 'trial',
        startsAt: new Date((nowSec - 200_000) * 1000),
        expiresAt: new Date((nowSec - 100_000) * 1000),
      });
    const verdict = await buildSyncVerdict(createDb(env.DB), USER, PROJECT);
    expect(verdict).toEqual({
      ok: true,
      principal: USER,
      context: { role: 'member', writeAllowed: false },
    });
  });
});
