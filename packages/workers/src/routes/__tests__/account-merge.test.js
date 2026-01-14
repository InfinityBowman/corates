/**
 * Integration tests for account merge routes
 * Tests account merging flow (initiate, verify, complete, cancel)
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase, json } from '@/__tests__/helpers.js';
import {
  buildUser,
  buildOrg,
  buildOrgMember,
  buildProject,
  buildProjectMember,
  resetCounter,
} from '@/__tests__/factories';

// Mock postmark
vi.mock('postmark', () => {
  return {
    Client: class {
      constructor() {}
      sendEmail() {
        return Promise.resolve({ Message: 'mock' });
      }
    },
  };
});

// Mock auth middleware
vi.mock('@/middleware/auth.js', () => {
  return {
    requireAuth: async (c, next) => {
      const userId = c.req.raw.headers.get('x-test-user-id') || 'user-1';
      const email = c.req.raw.headers.get('x-test-user-email') || 'user1@example.com';
      c.set('user', {
        id: userId,
        email,
        name: 'Test User',
        displayName: 'Test User',
        image: null,
      });
      c.set('session', { id: 'test-session' });
      await next();
    },
    getAuth: c => ({
      user: c.get('user'),
      session: c.get('session'),
    }),
  };
});

// Mock email service
vi.mock('@/auth/email.js', () => {
  return {
    createEmailService: () => ({
      sendEmail: async () => ({ success: true }),
    }),
  };
});

let app;

beforeAll(async () => {
  const { accountMergeRoutes } = await import('../account-merge.js');
  app = new Hono();
  app.route('/api/accounts/merge', accountMergeRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
});

async function fetchAccountMerge(path, init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      'x-test-user-id': 'user-1',
      'x-test-user-email': 'user1@example.com',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

async function seedAccount(userId, providerId = 'google') {
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

describe('Account Merge Routes - POST /api/accounts/merge/initiate', () => {
  it('should initiate merge request successfully', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });

    await seedAccount(user1.id, 'google');

    const res = await fetchAccountMerge('/api/accounts/merge/initiate', {
      method: 'POST',
      headers: { 'x-test-user-id': user1.id, 'x-test-user-email': user1.email },
      body: JSON.stringify({
        targetEmail: user2.email,
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.mergeToken).toBeDefined();
    expect(body.targetEmail).toBe(user2.email);
    expect(body.preview.currentProviders).toContain('google');
  });

  it('should reject merging with self', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });

    const res = await fetchAccountMerge('/api/accounts/merge/initiate', {
      method: 'POST',
      headers: { 'x-test-user-id': user1.id, 'x-test-user-email': user1.email },
      body: JSON.stringify({
        targetEmail: user1.email,
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });

  it('should return 404 when target user does not exist', async () => {
    const user1 = await buildUser({ email: 'user1@example.com' });

    const res = await fetchAccountMerge('/api/accounts/merge/initiate', {
      method: 'POST',
      headers: { 'x-test-user-id': user1.id, 'x-test-user-email': user1.email },
      body: JSON.stringify({
        targetEmail: 'nonexistent@example.com',
      }),
    });

    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.code).toBe('USER_NOT_FOUND');
  });

  it('should validate required fields', async () => {
    const res = await fetchAccountMerge('/api/accounts/merge/initiate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_FIELD_REQUIRED');
  });

  it('should enforce rate limiting', async () => {
    // Skip test if RATE_LIMIT_KV is not configured
    if (!env.RATE_LIMIT_KV) {
      return;
    }

    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });

    // Mock rate limit KV to simulate rate limit exceeded for merge-initiate key
    const originalGet = env.RATE_LIMIT_KV.get;
    env.RATE_LIMIT_KV.get = vi.fn(async key => {
      if (key.includes('merge-initiate')) {
        return JSON.stringify({ count: 3, resetAt: Date.now() + 10000 });
      }
      return originalGet ? await originalGet(key) : null;
    });

    try {
      const res = await fetchAccountMerge('/api/accounts/merge/initiate', {
        method: 'POST',
        headers: { 'x-test-user-id': user1.id, 'x-test-user-email': user1.email },
        body: JSON.stringify({
          targetEmail: user2.email,
        }),
      });

      expect(res.status).toBe(429);
      const body = await json(res);
      expect(body.code).toBeDefined();
    } finally {
      // Restore the original get mock
      env.RATE_LIMIT_KV.get = originalGet;
    }
  });
});

describe('Account Merge Routes - POST /api/accounts/merge/verify', () => {
  it('should verify code successfully', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });

    // Create merge request
    const mergeToken = 'test-token-123';
    const verificationCode = '123456';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const mergeData = {
      token: mergeToken,
      code: verificationCode,
      initiatorId: user1.id,
      initiatorEmail: user1.email,
      targetId: user2.id,
      targetEmail: user2.email,
      verified: false,
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        `merge:${user1.id}:${user2.id}`,
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/verify', {
      method: 'POST',
      headers: { 'x-test-user-id': user1.id, 'x-test-user-email': user1.email },
      body: JSON.stringify({
        mergeToken,
        code: verificationCode,
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.message).toContain('verified');
  });

  it('should reject invalid code', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });

    const mergeToken = 'test-token-123';
    const verificationCode = '123456';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const mergeData = {
      token: mergeToken,
      code: verificationCode,
      initiatorId: user1.id,
      targetId: user2.id,
      verified: false,
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        `merge:${user1.id}:${user2.id}`,
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/verify', {
      method: 'POST',
      headers: { 'x-test-user-id': user1.id, 'x-test-user-email': user1.email },
      body: JSON.stringify({
        mergeToken,
        code: 'wrong-code',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });

  it('should reject expired merge request', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });

    const mergeToken = 'test-token-123';
    const verificationCode = '123456';
    const expiresAt = new Date(Date.now() - 1000); // Expired
    const mergeData = {
      token: mergeToken,
      code: verificationCode,
      initiatorId: user1.id,
      targetId: user2.id,
      verified: false,
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        `merge:${user1.id}:${user2.id}`,
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/verify', {
      method: 'POST',
      headers: { 'x-test-user-id': user1.id, 'x-test-user-email': user1.email },
      body: JSON.stringify({
        mergeToken,
        code: verificationCode,
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });
});

describe('Account Merge Routes - POST /api/accounts/merge/complete', () => {
  it('should complete merge successfully', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    // Create user1 (initiator) and user2 (target to be merged)
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });

    await seedAccount(user1.id, 'google');
    await seedAccount(user2.id, 'github');

    // Create org with user2 as owner
    const { org } = await buildOrg({ owner: user2 });
    // Add user1 as member
    await buildOrgMember({ orgId: org.id, user: user1, role: 'member' });

    // Create project owned by user2
    const { project } = await buildProject({ org, owner: user2 });
    // Add user1 as project member
    await buildProjectMember({ projectId: project.id, orgId: org.id, user: user1, role: 'member' });

    // Create verified merge request
    const mergeToken = 'test-token-123';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const mergeData = {
      token: mergeToken,
      code: '123456',
      initiatorId: user1.id,
      targetId: user2.id,
      verified: true,
      verifiedAt: Date.now(),
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        `merge:${user1.id}:${user2.id}`,
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/complete', {
      method: 'POST',
      headers: { 'x-test-user-id': user1.id, 'x-test-user-email': user1.email },
      body: JSON.stringify({
        mergeToken,
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.mergedProviders).toContain('github');

    // Verify user2 is deleted
    const deletedUser = await env.DB.prepare('SELECT * FROM user WHERE id = ?1')
      .bind(user2.id)
      .first();
    expect(deletedUser).toBeNull();

    // Verify project ownership transferred
    const updatedProject = await env.DB.prepare('SELECT createdBy FROM projects WHERE id = ?1')
      .bind(project.id)
      .first();
    expect(updatedProject.createdBy).toBe(user1.id);
  });

  it('should reject unverified merge request', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });

    const mergeToken = 'test-token-123';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const mergeData = {
      token: mergeToken,
      code: '123456',
      initiatorId: user1.id,
      targetId: user2.id,
      verified: false, // Not verified
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        `merge:${user1.id}:${user2.id}`,
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/complete', {
      method: 'POST',
      headers: { 'x-test-user-id': user1.id, 'x-test-user-email': user1.email },
      body: JSON.stringify({
        mergeToken,
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });
});

describe('Account Merge Routes - DELETE /api/accounts/merge/cancel', () => {
  it('should cancel merge request', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const user1 = await buildUser({ email: 'user1@example.com' });
    const user2 = await buildUser({ email: 'user2@example.com' });

    const mergeToken = 'test-token-123';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const mergeData = {
      token: mergeToken,
      code: '123456',
      initiatorId: user1.id,
      targetId: user2.id,
      verified: false,
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        `merge:${user1.id}:${user2.id}`,
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/cancel', {
      method: 'DELETE',
      headers: { 'x-test-user-id': user1.id, 'x-test-user-email': user1.email },
      body: JSON.stringify({
        mergeToken,
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    // Verify merge request is deleted
    const verification = await env.DB.prepare('SELECT * FROM verification WHERE identifier = ?1')
      .bind(`merge:${user1.id}:${user2.id}`)
      .first();
    expect(verification).toBeNull();
  });
});
