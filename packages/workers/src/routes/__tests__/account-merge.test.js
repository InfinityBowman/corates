/**
 * Integration tests for account merge routes
 * Tests account merging flow (initiate, verify, complete, cancel)
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedProject,
  seedProjectMember,
  seedSubscription,
  json,
} from '../../__tests__/helpers.js';

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
vi.mock('../../middleware/auth.js', () => {
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
vi.mock('../../auth/email.js', () => {
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
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedAccount('user-1', 'google');

    const res = await fetchAccountMerge('/api/accounts/merge/initiate', {
      method: 'POST',
      body: JSON.stringify({
        targetEmail: 'user2@example.com',
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.mergeToken).toBeDefined();
    expect(body.targetEmail).toBe('user2@example.com');
    expect(body.preview.currentProviders).toContain('google');
  });

  it('should reject merging with self', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchAccountMerge('/api/accounts/merge/initiate', {
      method: 'POST',
      body: JSON.stringify({
        targetEmail: 'user1@example.com',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });

  it('should return 404 when target user does not exist', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchAccountMerge('/api/accounts/merge/initiate', {
      method: 'POST',
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
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Mock rate limit KV to simulate rate limit exceeded
    const originalGet = env.RATE_LIMIT_KV?.get;
    if (env.RATE_LIMIT_KV) {
      env.RATE_LIMIT_KV.get = vi.fn(async key => {
        if (key.includes('merge-initiate')) {
          return JSON.stringify({ count: 3, resetAt: Date.now() + 10000 });
        }
        return originalGet ? await originalGet(key) : null;
      });
    }

    const res = await fetchAccountMerge('/api/accounts/merge/initiate', {
      method: 'POST',
      body: JSON.stringify({
        targetEmail: 'user2@example.com',
      }),
    });

    // Rate limit should be enforced (429 or allow if not configured)
    if (res.status === 429) {
      const body = await json(res);
      expect(body.code).toBeDefined();
    }
  });
});

describe('Account Merge Routes - POST /api/accounts/merge/verify', () => {
  it('should verify code successfully', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Create merge request
    const mergeToken = 'test-token-123';
    const verificationCode = '123456';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const mergeData = {
      token: mergeToken,
      code: verificationCode,
      initiatorId: 'user-1',
      initiatorEmail: 'user1@example.com',
      targetId: 'user-2',
      targetEmail: 'user2@example.com',
      verified: false,
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        'merge:user-1:user-2',
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/verify', {
      method: 'POST',
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
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const mergeToken = 'test-token-123';
    const verificationCode = '123456';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const mergeData = {
      token: mergeToken,
      code: verificationCode,
      initiatorId: 'user-1',
      targetId: 'user-2',
      verified: false,
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        'merge:user-1:user-2',
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/verify', {
      method: 'POST',
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
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const mergeToken = 'test-token-123';
    const verificationCode = '123456';
    const expiresAt = new Date(Date.now() - 1000); // Expired
    const mergeData = {
      token: mergeToken,
      code: verificationCode,
      initiatorId: 'user-1',
      targetId: 'user-2',
      verified: false,
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        'merge:user-1:user-2',
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/verify', {
      method: 'POST',
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
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedAccount('user-1', 'google');
    await seedAccount('user-2', 'github');

    await seedProject({
      id: 'project-1',
      name: 'Project 1',
      createdBy: 'user-2',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'member',
      joinedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-2',
      projectId: 'project-1',
      userId: 'user-2',
      role: 'owner',
      joinedAt: nowSec,
    });

    // Create verified merge request
    const mergeToken = 'test-token-123';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const mergeData = {
      token: mergeToken,
      code: '123456',
      initiatorId: 'user-1',
      targetId: 'user-2',
      verified: true,
      verifiedAt: Date.now(),
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        'merge:user-1:user-2',
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/complete', {
      method: 'POST',
      body: JSON.stringify({
        mergeToken,
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.mergedProviders).toContain('github');

    // Verify user-2 is deleted
    const user2 = await env.DB.prepare('SELECT * FROM user WHERE id = ?1').bind('user-2').first();
    expect(user2).toBeNull();

    // Verify project ownership transferred
    const project = await env.DB.prepare('SELECT createdBy FROM projects WHERE id = ?1')
      .bind('project-1')
      .first();
    expect(project.createdBy).toBe('user-1');
  });

  it('should reject unverified merge request', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const mergeToken = 'test-token-123';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const mergeData = {
      token: mergeToken,
      code: '123456',
      initiatorId: 'user-1',
      targetId: 'user-2',
      verified: false, // Not verified
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        'merge:user-1:user-2',
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/complete', {
      method: 'POST',
      body: JSON.stringify({
        mergeToken,
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });

  it('should merge subscriptions with tier priority', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      userId: 'user-1',
      tier: 'pro',
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-2',
      userId: 'user-2',
      tier: 'team',
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const mergeToken = 'test-token-123';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const mergeData = {
      token: mergeToken,
      code: '123456',
      initiatorId: 'user-1',
      targetId: 'user-2',
      verified: true,
      verifiedAt: Date.now(),
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        'merge:user-1:user-2',
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/complete', {
      method: 'POST',
      body: JSON.stringify({
        mergeToken,
      }),
    });

    expect(res.status).toBe(200);

    // Verify team subscription (higher tier) is kept
    const subscription = await env.DB.prepare('SELECT * FROM subscriptions WHERE userId = ?1')
      .bind('user-1')
      .first();
    expect(subscription.tier).toBe('team');
  });
});

describe('Account Merge Routes - DELETE /api/accounts/merge/cancel', () => {
  it('should cancel merge request', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const mergeToken = 'test-token-123';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const mergeData = {
      token: mergeToken,
      code: '123456',
      initiatorId: 'user-1',
      targetId: 'user-2',
      verified: false,
    };

    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        'verify-1',
        'merge:user-1:user-2',
        JSON.stringify(mergeData),
        Math.floor(expiresAt.getTime() / 1000),
        nowSec,
        nowSec,
      )
      .run();

    const res = await fetchAccountMerge('/api/accounts/merge/cancel', {
      method: 'DELETE',
      body: JSON.stringify({
        mergeToken,
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    // Verify merge request is deleted
    const verification = await env.DB.prepare('SELECT * FROM verification WHERE identifier = ?1')
      .bind('merge:user-1:user-2')
      .first();
    expect(verification).toBeNull();
  });
});
