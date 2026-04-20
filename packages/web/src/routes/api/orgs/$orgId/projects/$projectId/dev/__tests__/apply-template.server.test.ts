import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildProject, resetCounter } from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import { handlePost as applyTemplateHandler } from '../apply-template';

let currentUser: { id: string; email: string } = { id: 'user-1', email: 'user1@example.com' };

function mockSession(overrides?: { userId?: string; email?: string }): Session {
  return {
    user: {
      id: overrides?.userId ?? currentUser.id,
      email: overrides?.email ?? currentUser.email,
      name: 'Test User',
    },
    session: {
      id: 'test-session',
      userId: overrides?.userId ?? currentUser.id,
    },
  } as Session;
}

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs(['project-1']);
  resetCounter();
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

describe('POST /api/orgs/:orgId/projects/:projectId/dev/apply-template', () => {
  it('returns 400 when template query param is missing', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await applyTemplateHandler({
      request: new Request(
        `http://localhost/api/orgs/${org.id}/projects/${project.id}/dev/apply-template`,
        { method: 'POST' },
      ),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeDefined();
  });
});
