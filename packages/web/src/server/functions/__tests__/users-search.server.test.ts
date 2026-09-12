import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { DomainErrorException } from '@corates/shared';
import { createDb } from '@corates/db/client';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import {
  buildUser,
  buildOrg,
  buildOrgMember,
  buildProject,
  buildProjectMember,
  resetCounter,
} from '@/__tests__/server/factories';
import { searchUsers } from '@/server/functions/users.server';

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

const dummyRequest = new Request('http://localhost/api/users/search');

async function buildWorkspace() {
  const { org, owner } = await buildOrg();
  currentUser = { id: owner.id, email: owner.email };
  return { org, owner };
}

describe('searchUsers', () => {
  it('finds workspace members by name, given name, and username', async () => {
    const { org } = await buildWorkspace();
    const byName = await buildUser({ name: 'John Doe' });
    const byGiven = await buildUser({ givenName: 'Johnny' });
    const byUsername = await buildUser({ username: 'johndoe' });
    for (const user of [byName, byGiven, byUsername]) {
      await buildOrgMember({ orgId: org.id, user });
    }

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'JOHN',
      orgId: org.id,
    });
    expect(result.map(u => u.id).sort()).toEqual([byName.id, byGiven.id, byUsername.id].sort());
  });

  it('returns the full email of a workspace member', async () => {
    const { org } = await buildWorkspace();
    const colleague = await buildUser({ name: 'Ada Lovelace', email: 'ada@example.com' });
    await buildOrgMember({ orgId: org.id, user: colleague });

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'ada',
      orgId: org.id,
    });
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('ada@example.com');
  });

  it('never returns users outside the workspace, even by exact email', async () => {
    const { org } = await buildWorkspace();
    await buildUser({ name: 'John Outsider', email: 'john@elsewhere.org' });

    for (const q of ['john', 'john@elsewhere.org', '@elsewhere']) {
      const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
        q,
        orgId: org.id,
      });
      expect(result).toEqual([]);
    }
  });

  it('matches a workspace member by email', async () => {
    const { org } = await buildWorkspace();
    const colleague = await buildUser({ name: 'Ada Lovelace', email: 'ada@example.com' });
    await buildOrgMember({ orgId: org.id, user: colleague });

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'ada@example.com',
      orgId: org.id,
    });
    expect(result.map(u => u.id)).toEqual([colleague.id]);
  });

  it('rejects a caller who is not in the workspace', async () => {
    const { org } = await buildOrg();
    const stranger = await buildUser();
    currentUser = { id: stranger.id, email: stranger.email };

    await expect(
      searchUsers(createDb(env.DB), mockSession(), dummyRequest, { q: 'any', orgId: org.id }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects query shorter than 2 characters', async () => {
    const { org } = await buildWorkspace();
    try {
      await searchUsers(createDb(env.DB), mockSession(), dummyRequest, { q: 'a', orgId: org.id });
      expect.fail('Should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(400);
      const body = res.toDomainError() as { code: string; message: string };
      expect(body.code).toMatch(/VALIDATION/);
      expect(body.message).toMatch(/2 characters|too short/i);
    }
  });

  it('caps limit at 20', async () => {
    const { org } = await buildWorkspace();
    for (let i = 0; i < 25; i++) {
      const user = await buildUser({ name: `Searchuser ${i}` });
      await buildOrgMember({ orgId: org.id, user });
    }

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'searchuser',
      orgId: org.id,
      limit: 100,
    });
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('excludes the current user', async () => {
    const { org, owner } = await buildWorkspace();
    const other = await buildUser({ name: 'Other User' });
    await buildOrgMember({ orgId: org.id, user: other });

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'user',
      orgId: org.id,
    });
    expect(result.find(u => u.id === owner.id)).toBeUndefined();
    expect(result.find(u => u.id === other.id)).toBeDefined();
  });

  it('excludes project members when projectId provided', async () => {
    const { project, owner, org } = await buildProject();
    const projectMember = await buildProjectMember({
      projectId: project.id,
      orgId: org.id,
      role: 'member',
    });
    const colleague = await buildUser({ name: 'User Three' });
    await buildOrgMember({ orgId: org.id, user: colleague });
    currentUser = { id: owner.id, email: owner.email };

    const result = await searchUsers(createDb(env.DB), mockSession(), dummyRequest, {
      q: 'user',
      orgId: org.id,
      projectId: project.id,
    });
    expect(result.find(u => u.id === projectMember.user.id)).toBeUndefined();
    expect(result.find(u => u.id === colleague.id)).toBeDefined();
  });
});
