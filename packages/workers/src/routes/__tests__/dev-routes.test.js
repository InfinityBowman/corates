/**
 * Regression tests for dev-routes
 *
 * I5: apply-template must return 400 when template query param is missing
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  clearProjectDOs,
  seedUser,
  seedOrganization,
  seedOrgMember,
  seedProject,
  seedProjectMember,
} from '@/__tests__/helpers.js';

// Mock postmark (required by transitive email imports)
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
        givenName: 'Test',
        familyName: 'User',
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

// Mock billing resolver (needed by project access middleware)
vi.mock('@/lib/billingResolver.js', () => {
  return {
    resolveOrgAccess: async () => ({
      access: 'write',
      reason: 'active_subscription',
      quota: { projects: { used: 0, limit: 999 } },
    }),
  };
});

describe('I5: apply-template missing template param', () => {
  const orgId = 'dev-org';
  const projectId = 'dev-project';
  const userId = 'user-1';
  const nowSec = Math.floor(Date.now() / 1000);
  let app;

  beforeAll(async () => {
    // Dynamic import after mocks are set up
    const module = await import('@/index.js');
    app = module.default;
  });

  beforeEach(async () => {
    await resetTestDatabase();
    await clearProjectDOs([projectId]);

    await seedUser({
      id: userId,
      name: 'Test User',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: orgId,
      name: 'Dev Org',
      slug: 'dev-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      userId,
      organizationId: orgId,
      role: 'owner',
      createdAt: nowSec,
    });

    await seedProject({
      id: projectId,
      name: 'Dev Project',
      orgId,
      createdBy: userId,
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId,
      userId,
      role: 'owner',
      joinedAt: nowSec,
    });
  });

  it('should return 400 when template query param is missing', async () => {
    const ctx = createExecutionContext();
    const req = new Request(
      `http://localhost/api/orgs/${orgId}/projects/${projectId}/dev/apply-template`,
      {
        method: 'POST',
        headers: {
          'x-test-user-id': userId,
          'x-test-user-email': 'user1@example.com',
        },
      },
    );

    const testEnv = {
      ...env,
      DEV_MODE: true,
    };

    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
