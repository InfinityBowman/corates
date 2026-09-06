// Boots the test worker at import so the DO bindings are up before the per-test timeout starts.
import 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, buildProject, resetCounter } from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import { DomainErrorException } from '@corates/shared';
import { createOrgProject } from '@/server/functions/org-projects.server';

const freeBilling = {
  accessMode: 'free',
  source: 'free',
  quotas: { 'projects.max': 1, 'collaborators.org.max': 3 },
  entitlements: { 'project.create': true },
};

vi.mock('@corates/workers/billing-resolver', () => ({
  resolveOrgAccess: vi.fn(async () => freeBilling),
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  resetCounter();
});

function sessionFor(user: { id: string; email: string }): Session {
  return {
    user: { id: user.id, email: user.email, name: 'Test User' },
    session: { id: 'test-session', userId: user.id },
  } as Session;
}

describe('free project cap', () => {
  it('blocks a free project when the owner already has one in another free org', async () => {
    const { owner } = await buildProject();
    const { org: secondOrg } = await buildOrg({ owner });

    try {
      await createOrgProject(sessionFor(owner), createDb(env.DB), secondOrg.id, {
        name: 'Second free project',
      });
      expect.fail('expected the free project cap to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainErrorException);
      expect((err as DomainErrorException).details).toMatchObject({
        reason: 'free_project_cap',
        used: 1,
        limit: 1,
      });
    }
  });

  it('rejects non-owner members, so the cap always attributes to an owner', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });

    try {
      await createOrgProject(sessionFor(member), createDb(env.DB), org.id, {
        name: 'Member project',
      });
      expect.fail('expected the owner role check to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainErrorException);
      expect((err as DomainErrorException).details).toMatchObject({
        reason: 'insufficient_org_role',
        required: 'owner',
      });
    }
  });

  it('allows a free project in an org whose owner has none elsewhere', async () => {
    const { org, owner } = await buildOrg();

    const project = await createOrgProject(sessionFor(owner), createDb(env.DB), org.id, {
      name: 'First free project',
    });

    expect(project.orgId).toBe(org.id);
  });
});
