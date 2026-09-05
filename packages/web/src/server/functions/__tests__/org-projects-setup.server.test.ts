// Boots the test worker at import so the DO bindings are up before the per-test timeout starts.
import 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildProjectWithMembers, resetCounter } from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import { DomainErrorException } from '@corates/shared';
import {
  createOrgProject,
  updateProjectSetupStepById,
} from '@/server/functions/org-projects.server';

let currentUser: { id: string; email: string } = { id: 'user-1', email: 'user1@example.com' };

function mockSession(): Session {
  return {
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  } as Session;
}

vi.mock('@corates/workers/billing-resolver', () => ({
  resolveOrgAccess: vi.fn(async () => ({
    accessMode: 'write',
    source: 'free',
    quotas: { 'projects.max': 10, 'collaborators.org.max': -1 },
    entitlements: { 'project.create': true },
  })),
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  resetCounter();
});

async function readSetupStep(projectId: string) {
  const row = await createDb(env.DB)
    .select({ setupStep: projects.setupStep })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();
  return row?.setupStep;
}

describe('project setup step', () => {
  it('starts new projects at the studies step', async () => {
    const { org, owner } = await buildProjectWithMembers({ memberCount: 0 });
    currentUser = { id: owner.id, email: owner.email };

    const project = await createOrgProject(mockSession(), createDb(env.DB), org.id, {
      name: 'Fresh project',
    });

    expect(project.setupStep).toBe('studies');
    expect(await readSetupStep(project.id)).toBe('studies');
  });

  it('lets the owner finish setup by clearing the step', async () => {
    const { project, org, owner } = await buildProjectWithMembers({ memberCount: 0 });
    currentUser = { id: owner.id, email: owner.email };
    const db = createDb(env.DB);
    await db.update(projects).set({ setupStep: 'studies' }).where(eq(projects.id, project.id));

    const result = await updateProjectSetupStepById(mockSession(), db, org.id, project.id, null);

    expect(result.setupStep).toBeNull();
    expect(await readSetupStep(project.id)).toBeNull();
  });

  it('rejects members who are not owners', async () => {
    const { project, org, members } = await buildProjectWithMembers({ memberCount: 1 });
    const member = members[1].user;
    currentUser = { id: member.id, email: member.email };

    try {
      await updateProjectSetupStepById(mockSession(), createDb(env.DB), org.id, project.id, null);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainErrorException);
      expect((err as DomainErrorException).statusCode).toBe(403);
    }
  });
});
