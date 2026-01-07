/**
 * Tests for requireEntitlement middleware
 * Tests entitlement gating, context attachment, and error handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedOrgMember,
} from '@/__tests__/helpers.js';
import { requireEntitlement } from '../requireEntitlement.js';
import { requireOrgMembership } from '../requireOrg.js';
import { requireAuth } from '../auth.js';

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
vi.mock('../auth.js', () => {
  return {
    requireAuth: async (c, next) => {
      const userId = c.req.raw.headers.get('x-test-user-id');
      if (userId) {
        c.set('user', {
          id: userId,
          email: c.req.raw.headers.get('x-test-user-email') || 'test@example.com',
          name: 'Test User',
        });
        c.set('session', { id: 'test-session' });
      }
      await next();
    },
    getAuth: c => ({
      user: c.get('user') || null,
      session: c.get('session') || null,
    }),
  };
});

// Mock billing resolver - use factory function that returns a new mock each time
vi.mock('@/lib/billingResolver.js', () => {
  return {
    resolveOrgAccess: vi.fn(),
  };
});

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

async function fetchApp(app, path, init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

let mockResolveOrgAccess;

beforeEach(async () => {
  await resetTestDatabase();
  const billingResolver = await import('@/lib/billingResolver.js');
  mockResolveOrgAccess = billingResolver.resolveOrgAccess;
  mockResolveOrgAccess.mockClear();
});

describe('requireEntitlement middleware', () => {
  describe('Authentication checks', () => {
    it('should return 401 when no auth user is present', async () => {
      const app = new Hono();
      app.get(
        '/orgs/:orgId/test',
        requireAuth,
        requireOrgMembership(),
        requireEntitlement('project.create'),
        c => c.json({ success: true }),
      );

      const res = await fetchApp(app, '/orgs/org-1/test');

      // Should fail at requireOrgMembership first (401), but requireEntitlement should also handle missing auth
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('Org context checks', () => {
    it('should return 403 org_context_required when org context is missing', async () => {
      const app = new Hono();
      // Skip requireOrgMembership to test requireEntitlement in isolation
      // But still need requireAuth to set user context
      app.get('/test', requireAuth, requireEntitlement('project.create'), c =>
        c.json({ success: true }),
      );

      const res = await fetchApp(app, '/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(403);
      const body = await json(res);
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('org_context_required');
    });
  });

  describe('Entitlement checks', () => {
    it('should return 403 missing_entitlement when entitlement is not present', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        name: 'User 1',
        email: 'user1@example.com',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedOrganization({
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        createdAt: nowSec,
      });

      await seedOrgMember({
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'member',
        createdAt: nowSec,
      });

      // Mock resolveOrgAccess to return entitlements WITHOUT project.create
      mockResolveOrgAccess.mockResolvedValueOnce({
        effectivePlanId: 'free',
        source: 'subscription',
        accessMode: 'full',
        entitlements: {
          'project.view': true,
          'project.edit': false,
          'project.create': false,
        },
        quotas: {},
      });

      const app = new Hono();
      app.get(
        '/orgs/:orgId/test',
        requireAuth,
        requireOrgMembership(),
        requireEntitlement('project.create'),
        c => c.json({ success: true }),
      );

      const res = await fetchApp(app, '/orgs/org-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(403);
      const body = await json(res);
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('missing_entitlement');
      expect(body.details?.entitlement).toBe('project.create');
    });

    it('should allow access when entitlement is present', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        name: 'User 1',
        email: 'user1@example.com',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedOrganization({
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        createdAt: nowSec,
      });

      await seedOrgMember({
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'member',
        createdAt: nowSec,
      });

      // Mock resolveOrgAccess to return entitlements WITH project.create
      const mockOrgBilling = {
        effectivePlanId: 'pro',
        source: 'subscription',
        accessMode: 'full',
        entitlements: {
          'project.view': true,
          'project.edit': true,
          'project.create': true,
        },
        quotas: {
          projects: 100,
        },
      };

      mockResolveOrgAccess.mockResolvedValueOnce(mockOrgBilling);

      const app = new Hono();
      app.get(
        '/orgs/:orgId/test',
        requireAuth,
        requireOrgMembership(),
        requireEntitlement('project.create'),
        c => {
          const orgBilling = c.get('orgBilling');
          const entitlements = c.get('entitlements');
          return c.json({ success: true, orgBilling, entitlements });
        },
      );

      const res = await fetchApp(app, '/orgs/org-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.success).toBe(true);
      expect(body.orgBilling).toEqual(mockOrgBilling);
      expect(body.entitlements).toEqual(mockOrgBilling.entitlements);
    });
  });

  describe('Context attachment', () => {
    it('should attach orgBilling and entitlements to context when entitlement is present', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        name: 'User 1',
        email: 'user1@example.com',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedOrganization({
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        createdAt: nowSec,
      });

      await seedOrgMember({
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'member',
        createdAt: nowSec,
      });

      const mockOrgBilling = {
        effectivePlanId: 'pro',
        source: 'subscription',
        accessMode: 'full',
        entitlements: {
          'project.create': true,
          'project.edit': true,
          'project.view': true,
          'advanced.features': true,
        },
        quotas: {
          projects: 100,
          storage: 1024 * 1024 * 1024,
        },
        subscription: {
          id: 'sub-1',
          status: 'active',
        },
      };

      mockResolveOrgAccess.mockResolvedValueOnce(mockOrgBilling);

      const app = new Hono();
      app.get(
        '/orgs/:orgId/test',
        requireAuth,
        requireOrgMembership(),
        requireEntitlement('project.create'),
        c => {
          const orgBilling = c.get('orgBilling');
          const entitlements = c.get('entitlements');
          return c.json({
            orgBilling,
            entitlements,
            hasProjectCreate: entitlements?.['project.create'] === true,
          });
        },
      );

      const res = await fetchApp(app, '/orgs/org-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.orgBilling).toEqual(mockOrgBilling);
      expect(body.entitlements).toEqual(mockOrgBilling.entitlements);
      expect(body.hasProjectCreate).toBe(true);
    });
  });

  describe('Error format', () => {
    it('should return domain error format when entitlement is missing', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        name: 'User 1',
        email: 'user1@example.com',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedOrganization({
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        createdAt: nowSec,
      });

      await seedOrgMember({
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'member',
        createdAt: nowSec,
      });

      mockResolveOrgAccess.mockResolvedValueOnce({
        effectivePlanId: 'free',
        source: 'subscription',
        accessMode: 'full',
        entitlements: {
          'project.create': false,
        },
        quotas: {},
      });

      const app = new Hono();
      app.get(
        '/orgs/:orgId/test',
        requireAuth,
        requireOrgMembership(),
        requireEntitlement('project.create'),
        c => c.json({ success: true }),
      );

      const res = await fetchApp(app, '/orgs/org-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(403);
      const body = await json(res);
      // Should use domain error format (code, message, details)
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.message).toBeDefined();
      expect(body.details).toBeDefined();
      expect(body.details?.reason).toBe('missing_entitlement');
      expect(body.details?.entitlement).toBe('project.create');
    });

    it('should return domain error format when auth user is missing', async () => {
      const app = new Hono();
      // Skip requireOrgMembership to test requireEntitlement's auth check
      app.get('/test', requireEntitlement('project.create'), c => c.json({ success: true }));

      const res = await fetchApp(app, '/test');

      expect(res.status).toBe(401);
      const body = await json(res);
      expect(body.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('Multiple entitlements', () => {
    it('should check each entitlement independently', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        name: 'User 1',
        email: 'user1@example.com',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedOrganization({
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        createdAt: nowSec,
      });

      await seedOrgMember({
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'member',
        createdAt: nowSec,
      });

      // Mock with project.create but NOT advanced.features
      // Need to mock twice - once for each route
      mockResolveOrgAccess
        .mockResolvedValueOnce({
          effectivePlanId: 'basic',
          source: 'subscription',
          accessMode: 'full',
          entitlements: {
            'project.create': true,
            'advanced.features': false,
          },
          quotas: {},
        })
        .mockResolvedValueOnce({
          effectivePlanId: 'basic',
          source: 'subscription',
          accessMode: 'full',
          entitlements: {
            'project.create': true,
            'advanced.features': false,
          },
          quotas: {},
        });

      const app = new Hono();
      app.get(
        '/orgs/:orgId/test1',
        requireAuth,
        requireOrgMembership(),
        requireEntitlement('project.create'),
        c => c.json({ success: true }),
      );

      app.get(
        '/orgs/:orgId/test2',
        requireAuth,
        requireOrgMembership(),
        requireEntitlement('advanced.features'),
        c => c.json({ success: true }),
      );

      const res1 = await fetchApp(app, '/orgs/org-1/test1', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      const res2 = await fetchApp(app, '/orgs/org-1/test2', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(403);
      const body2 = await json(res2);
      expect(body2.details?.entitlement).toBe('advanced.features');
    });
  });
});
