import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import { handler as initiateHandler } from '../initiate';
import { handler as verifyHandler } from '../verify';
import { handler as completeHandler } from '../complete';
import { handler as cancelHandler } from '../cancel';

let currentUser = { id: 'user-1', email: 'user1@example.com' };

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => ({
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  }),
}));

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

function jsonReq(path: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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

describe('POST /api/accounts/merge/initiate', () => {
  it('initiates merge request and queues email', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    await seedAccount(user1.id, 'google');
    currentUser = { id: user1.id, email: user1.email };

    const res = await initiateHandler({
      request: jsonReq('/api/accounts/merge/initiate', 'POST', { targetEmail: user2.email }),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.mergeToken).toBeDefined();
    expect(body.targetEmail).toBe(user2.email);
    expect(body.preview.currentProviders).toContain('google');
  });

  it('rejects merging with self', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user1.id, email: user1.email };

    const res = await initiateHandler({
      request: jsonReq('/api/accounts/merge/initiate', 'POST', { targetEmail: user1.email }),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });

  it('returns 404 when target user does not exist', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user1.id, email: user1.email };

    const res = await initiateHandler({
      request: jsonReq('/api/accounts/merge/initiate', 'POST', {
        targetEmail: 'nonexistent@example.com',
      }),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.code).toBe('USER_NOT_FOUND');
  });

  it('returns 400 when neither targetEmail nor targetOrcidId is provided', async () => {
    const res = await initiateHandler({
      request: jsonReq('/api/accounts/merge/initiate', 'POST', {}),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_FIELD_REQUIRED');
  });

  it('returns 400 when invalid JSON is submitted', async () => {
    const res = await initiateHandler({
      request: new Request('http://localhost/api/accounts/merge/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-json',
      }),
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });
});

describe('POST /api/accounts/merge/verify', () => {
  it('verifies code successfully', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    const mergeToken = 'test-token-123';
    const code = '123456';
    await seedMergeRequest({ userId: user1.id, targetId: user2.id, token: mergeToken, code });
    currentUser = { id: user1.id, email: user1.email };

    const res = await verifyHandler({
      request: jsonReq('/api/accounts/merge/verify', 'POST', { mergeToken, code }),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.message).toContain('verified');
  });

  it('rejects invalid code', async () => {
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

    const res = await verifyHandler({
      request: jsonReq('/api/accounts/merge/verify', 'POST', { mergeToken, code: 'wrong-code' }),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });

  it('rejects expired merge request', async () => {
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

    const res = await verifyHandler({
      request: jsonReq('/api/accounts/merge/verify', 'POST', { mergeToken, code: '123456' }),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });

  it('returns 404 when no merge request exists', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user1.id, email: user1.email };

    const res = await verifyHandler({
      request: jsonReq('/api/accounts/merge/verify', 'POST', {
        mergeToken: 'token',
        code: '123456',
      }),
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.code).toBe('USER_NOT_FOUND');
  });
});

describe('POST /api/accounts/merge/complete', () => {
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

    const res = await completeHandler({
      request: jsonReq('/api/accounts/merge/complete', 'POST', { mergeToken }),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.mergedProviders).toContain('github');

    const deletedUser = await env.DB.prepare('SELECT * FROM user WHERE id = ?1')
      .bind(user2.id)
      .first();
    expect(deletedUser).toBeNull();

    const updatedProject = await env.DB.prepare('SELECT createdBy FROM projects WHERE id = ?1')
      .bind(project.id)
      .first<{ createdBy: string }>();
    expect(updatedProject!.createdBy).toBe(user1.id);
  });

  it('rejects unverified merge request', async () => {
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

    const res = await completeHandler({
      request: jsonReq('/api/accounts/merge/complete', 'POST', { mergeToken }),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });
});

describe('DELETE /api/accounts/merge/cancel', () => {
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

    const res = await cancelHandler({
      request: jsonReq('/api/accounts/merge/cancel', 'DELETE', { mergeToken }),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);

    const row = await env.DB.prepare('SELECT * FROM verification WHERE identifier = ?1')
      .bind(`merge:${user1.id}:${user2.id}`)
      .first();
    expect(row).toBeNull();
  });

  it('returns success when no merge request exists', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    currentUser = { id: user1.id, email: user1.email };

    const res = await cancelHandler({
      request: jsonReq('/api/accounts/merge/cancel', 'DELETE', { mergeToken: 'any' }),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
  });

  it('rejects invalid token', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });
    await seedMergeRequest({
      userId: user1.id,
      targetId: user2.id,
      token: 'real-token',
      code: '123456',
    });
    currentUser = { id: user1.id, email: user1.email };

    const res = await cancelHandler({
      request: jsonReq('/api/accounts/merge/cancel', 'DELETE', { mergeToken: 'wrong-token' }),
      context: { db: createDb(env.DB) },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });
});
