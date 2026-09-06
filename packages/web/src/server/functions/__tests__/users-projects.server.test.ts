import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildProject, buildProjectWithMembers, resetCounter } from '@/__tests__/server/factories';
import { fetchMyProjects } from '@/server/functions/users.server';

let currentUser = { id: 'user-1', email: 'user1@example.com' };

function mockSession() {
  return {
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  };
}

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

describe('fetchMyProjects', () => {
  it('reports the full member count per project', async () => {
    const { project, owner, org } = await buildProjectWithMembers({ memberCount: 2 });
    const { project: solo } = await buildProject({ org, owner });
    currentUser = { id: owner.id, email: owner.email };

    const result = await fetchMyProjects(createDb(env.DB), mockSession());

    expect(result.find(p => p.id === project.id)?.memberCount).toBe(3);
    expect(result.find(p => p.id === solo.id)?.memberCount).toBe(1);
  });

  it('does not count members of projects the user is not in', async () => {
    const { project, owner } = await buildProject();
    await buildProjectWithMembers({ memberCount: 2 });
    currentUser = { id: owner.id, email: owner.email };

    const result = await fetchMyProjects(createDb(env.DB), mockSession());

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(project.id);
    expect(result[0].memberCount).toBe(1);
  });
});
