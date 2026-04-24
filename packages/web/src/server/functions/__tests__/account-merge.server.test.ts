import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import {
  buildUser,
  buildOrg,
  buildOrgMember,
  buildProject,
  buildProjectMember,
  resetCounter,
} from '@/__tests__/server/factories';
import {
  initiateMergeRequest,
  verifyMerge,
  completeMergeRequest,
  cancelMergeRequest,
} from '@/server/functions/account-merge.server';
import type { Session } from '@/server/middleware/auth';

let currentUser = { id: 'user-1', email: 'user1@example.com' };

function mockSession(): Session {
  return {
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  } as Session;
}

const dummyRequest = new Request('http://localhost/api/accounts/merge', { method: 'POST' });

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearProjectDOs(['project-1']);
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

async function seedAccount(userId: string, providerId = 'google') {
  const nowSec = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO account (id, userId, accountId, providerId, createdAt, updatedAt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(
      `acc-${userId}-${providerId}`,
      userId,
      `${providerId}-${userId}`,
      providerId,
      nowSec,
      nowSec,
    )
    .run();
}

async function seedMergeRequest(opts: {
  userId: string;
  targetId: string;
  token: string;
  code: string;
  verified?: boolean;
  expiresAt?: Date;
}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000);
  const mergeData = {
    token: opts.token,
    code: opts.code,
    initiatorId: opts.userId,
    initiatorEmail: `${opts.userId}@example.com`,
    targetId: opts.targetId,
    targetEmail: `${opts.targetId}@example.com`,
    verified: opts.verified ?? false,
  };
  await env.DB.prepare(
    `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(
      `verify-${opts.userId}-${opts.targetId}`,
      `merge:${opts.userId}:${opts.targetId}`,
      JSON.stringify(mergeData),
      Math.floor(expiresAt.getTime() / 1000),
      nowSec,
      nowSec,
    )
    .run();
}

describe('initiateMergeRequest', () => {
  it('initiates merge request and queues email', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    await seedAccount(user1.id, 'google');
    currentUser = { id: user1.id, email: user1.email };

    const result = await initiateMergeRequest(createDb(env.DB), mockSession(), dummyRequest, {
      targetEmail: user2.email,
    });

    expect(result.success).toBe(true);
    expect(result.mergeToken).toBeDefined();
    expect(result.targetEmail).toBe(user2.email);
    expect(result.preview.currentProviders).toContain('google');
  });

  it('throws 400 when merging with self', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user1.id, email: user1.email };

    try {
      await initiateMergeRequest(createDb(env.DB), mockSession(), dummyRequest, {
        targetEmail: user1.email,
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('VALIDATION_INVALID_INPUT');
    }
  });

  it('throws 404 when target user does not exist', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user1.id, email: user1.email };

    try {
      await initiateMergeRequest(createDb(env.DB), mockSession(), dummyRequest, {
        targetEmail: 'nonexistent@example.com',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(404);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('USER_NOT_FOUND');
    }
  });

  it('throws 400 when neither targetEmail nor targetOrcidId is provided', async () => {
    try {
      await initiateMergeRequest(createDb(env.DB), mockSession(), dummyRequest, {});
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('VALIDATION_FIELD_REQUIRED');
    }
  });
});

describe('verifyMerge', () => {
  it('verifies code successfully', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    const mergeToken = 'test-token-123';
    const code = '123456';
    await seedMergeRequest({ userId: user1.id, targetId: user2.id, token: mergeToken, code });
    currentUser = { id: user1.id, email: user1.email };

    const result = await verifyMerge(createDb(env.DB), mockSession(), dummyRequest, {
      mergeToken,
      code,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('verified');
  });

  it('throws 400 for invalid code', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    const mergeToken = 'test-token-123';
    await seedMergeRequest({
      userId: user1.id,
      targetId: user2.id,
      token: mergeToken,
      code: '123456',
    });
    currentUser = { id: user1.id, email: user1.email };

    try {
      await verifyMerge(createDb(env.DB), mockSession(), dummyRequest, {
        mergeToken,
        code: 'wrong-code',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('VALIDATION_INVALID_INPUT');
    }
  });

  it('throws 400 for expired merge request', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    const mergeToken = 'test-token-123';
    await seedMergeRequest({
      userId: user1.id,
      targetId: user2.id,
      token: mergeToken,
      code: '123456',
      expiresAt: new Date(Date.now() - 1000),
    });
    currentUser = { id: user1.id, email: user1.email };

    try {
      await verifyMerge(createDb(env.DB), mockSession(), dummyRequest, {
        mergeToken,
        code: '123456',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('VALIDATION_INVALID_INPUT');
    }
  });

  it('throws 404 when no merge request exists', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user1.id, email: user1.email };

    try {
      await verifyMerge(createDb(env.DB), mockSession(), dummyRequest, {
        mergeToken: 'token',
        code: '123456',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(404);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('USER_NOT_FOUND');
    }
  });
});

describe('completeMergeRequest', () => {
  it('completes merge, transfers projects, deletes secondary user', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    await seedAccount(user1.id, 'google');
    await seedAccount(user2.id, 'github');

    const { org } = await buildOrg({ owner: user2 });
    await buildOrgMember({ orgId: org.id, user: user1, role: 'member' });
    const { project } = await buildProject({ org, owner: user2 });
    await buildProjectMember({ projectId: project.id, orgId: org.id, user: user1, role: 'member' });

    const mergeToken = 'test-token-123';
    await seedMergeRequest({
      userId: user1.id,
      targetId: user2.id,
      token: mergeToken,
      code: '123456',
      verified: true,
    });
    currentUser = { id: user1.id, email: user1.email };

    const result = await completeMergeRequest(createDb(env.DB), mockSession(), mergeToken);

    expect(result.success).toBe(true);
    expect(result.mergedProviders).toContain('github');

    const deletedUser = await env.DB.prepare('SELECT * FROM user WHERE id = ?1')
      .bind(user2.id)
      .first();
    expect(deletedUser).toBeNull();

    const updatedProject = await env.DB.prepare('SELECT createdBy FROM projects WHERE id = ?1')
      .bind(project.id)
      .first<{ createdBy: string }>();
    expect(updatedProject!.createdBy).toBe(user1.id);
  });

  it('throws 400 for unverified merge request', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    const mergeToken = 'test-token-123';
    await seedMergeRequest({
      userId: user1.id,
      targetId: user2.id,
      token: mergeToken,
      code: '123456',
      verified: false,
    });
    currentUser = { id: user1.id, email: user1.email };

    try {
      await completeMergeRequest(createDb(env.DB), mockSession(), mergeToken);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('VALIDATION_INVALID_INPUT');
    }
  });
});

describe('cancelMergeRequest', () => {
  it('cancels merge request', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    const mergeToken = 'test-token-123';
    await seedMergeRequest({
      userId: user1.id,
      targetId: user2.id,
      token: mergeToken,
      code: '123456',
    });
    currentUser = { id: user1.id, email: user1.email };

    const result = await cancelMergeRequest(createDb(env.DB), mockSession(), mergeToken);
    expect(result.success).toBe(true);

    const row = await env.DB.prepare('SELECT * FROM verification WHERE identifier = ?1')
      .bind(`merge:${user1.id}:${user2.id}`)
      .first();
    expect(row).toBeNull();
  });

  it('returns success when no merge request exists', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user1.id, email: user1.email };

    const result = await cancelMergeRequest(createDb(env.DB), mockSession(), 'any');
    expect(result.success).toBe(true);
  });

  it('throws 400 for invalid token', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    await seedMergeRequest({
      userId: user1.id,
      targetId: user2.id,
      token: 'real-token',
      code: '123456',
    });
    currentUser = { id: user1.id, email: user1.email };

    try {
      await cancelMergeRequest(createDb(env.DB), mockSession(), 'wrong-token');
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('VALIDATION_INVALID_INPUT');
    }
  });
});
