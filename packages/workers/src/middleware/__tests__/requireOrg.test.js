/**
 * Tests for requireOrgMembership and requireProjectAccess middleware
 * Tests org/project authorization including the invariant that org roles and project roles are unrelated
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedOrgMember,
  seedProject,
  seedProjectMember,
} from '../../__tests__/helpers.js';
import { requireOrgMembership, requireProjectAccess } from '../requireOrg.js';
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

beforeEach(async () => {
  await resetTestDatabase();
});

describe('requireOrgMembership middleware', () => {
  describe('Authentication checks', () => {
    it('should return 401 when no auth user is present', async () => {
      const app = new Hono();
      app.get('/orgs/:orgId/test', requireOrgMembership(), c => c.json({ success: true }));

      const res = await fetchApp(app, '/orgs/org-1/test');

      expect(res.status).toBe(401);
      const body = await json(res);
      expect(body.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('Organization membership checks', () => {
    it('should return 403 not_org_member when user is not in org', async () => {
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

      const app = new Hono();
      app.get('/orgs/:orgId/test', requireAuth, requireOrgMembership(), c =>
        c.json({ success: true }),
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
      expect(body.details?.reason).toBe('not_org_member');
    });

    it('should allow access when user is org member', async () => {
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

      const app = new Hono();
      app.get('/orgs/:orgId/test', requireAuth, requireOrgMembership(), c => {
        const orgId = c.get('orgId');
        const orgRole = c.get('orgRole');
        return c.json({ success: true, orgId, orgRole });
      });

      const res = await fetchApp(app, '/orgs/org-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.success).toBe(true);
      expect(body.orgId).toBe('org-1');
      expect(body.orgRole).toBe('member');
    });

    it('should attach org context to request', async () => {
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
        role: 'admin',
        createdAt: nowSec,
      });

      const app = new Hono();
      app.get('/orgs/:orgId/test', requireAuth, requireOrgMembership(), c => {
        const org = c.get('org');
        return c.json({ org });
      });

      const res = await fetchApp(app, '/orgs/org-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.org).toEqual({
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
      });
    });
  });

  describe('Minimum org role enforcement', () => {
    it('should deny member when minRole is admin', async () => {
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

      const app = new Hono();
      app.get('/orgs/:orgId/test', requireAuth, requireOrgMembership('admin'), c =>
        c.json({ success: true }),
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
      expect(body.details?.reason).toBe('insufficient_org_role');
      expect(body.details?.required).toBe('admin');
      expect(body.details?.actual).toBe('member');
    });

    it('should allow admin when minRole is admin', async () => {
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
        role: 'admin',
        createdAt: nowSec,
      });

      const app = new Hono();
      app.get('/orgs/:orgId/test', requireAuth, requireOrgMembership('admin'), c =>
        c.json({ success: true }),
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
    });

    it('should allow owner when minRole is admin', async () => {
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
        role: 'owner',
        createdAt: nowSec,
      });

      const app = new Hono();
      app.get('/orgs/:orgId/test', requireAuth, requireOrgMembership('admin'), c =>
        c.json({ success: true }),
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
    });

    it('should deny admin when minRole is owner', async () => {
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
        role: 'admin',
        createdAt: nowSec,
      });

      const app = new Hono();
      app.get('/orgs/:orgId/test', requireAuth, requireOrgMembership('owner'), c =>
        c.json({ success: true }),
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
      expect(body.details?.reason).toBe('insufficient_org_role');
      expect(body.details?.required).toBe('owner');
      expect(body.details?.actual).toBe('admin');
    });
  });
});

describe('requireProjectAccess middleware', () => {
  describe('Prerequisites', () => {
    it('should return 403 org_context_required when org context is missing', async () => {
      const app = new Hono();
      app.get('/orgs/:orgId/projects/:projectId/test', requireAuth, requireProjectAccess(), c =>
        c.json({ success: true }),
      );

      const res = await fetchApp(app, '/orgs/org-1/projects/project-1/test', {
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

    it('should return 403 project_id_required when projectId param is empty', async () => {
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

      const app = new Hono();
      app.get(
        '/orgs/:orgId/projects/:projectId/test',
        requireAuth,
        requireOrgMembership(),
        async (c, next) => {
          // Manually set projectId param to empty string to test middleware behavior
          // This simulates what would happen if the router produced an empty projectId
          const originalParam = c.req.param.bind(c.req);
          c.req.param = key => {
            if (key === 'projectId') return '';
            return originalParam(key);
          };
          await next();
        },
        requireProjectAccess(),
        c => c.json({ success: true }),
      );

      const res = await fetchApp(app, '/orgs/org-1/projects/placeholder/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(403);
      const body = await json(res);
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('project_id_required');
    });
  });

  describe('Project existence and org matching', () => {
    it('should return 404 when project does not exist', async () => {
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

      const app = new Hono();
      app.get(
        '/orgs/:orgId/projects/:projectId/test',
        requireAuth,
        requireOrgMembership(),
        requireProjectAccess(),
        c => c.json({ success: true }),
      );

      const res = await fetchApp(app, '/orgs/org-1/projects/nonexistent-project/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(404);
      const body = await json(res);
      expect(body.code).toBe('PROJECT_NOT_FOUND');
      expect(body.details?.projectId).toBe('nonexistent-project');
    });

    it('should return PROJECT_NOT_IN_ORG when project belongs to different org', async () => {
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
        name: 'Test Org 1',
        slug: 'test-org-1',
        createdAt: nowSec,
      });

      await seedOrganization({
        id: 'org-2',
        name: 'Test Org 2',
        slug: 'test-org-2',
        createdAt: nowSec,
      });

      await seedOrgMember({
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'member',
        createdAt: nowSec,
      });

      await seedProject({
        id: 'project-1',
        name: 'Test Project',
        orgId: 'org-2',
        createdBy: 'user-1',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      const app = new Hono();
      app.get(
        '/orgs/:orgId/projects/:projectId/test',
        requireAuth,
        requireOrgMembership(),
        requireProjectAccess(),
        c => c.json({ success: true }),
      );

      const res = await fetchApp(app, '/orgs/org-1/projects/project-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(403);
      const body = await json(res);
      expect(body.code).toBe('PROJECT_NOT_IN_ORG');
      expect(body.details?.projectId).toBe('project-1');
      expect(body.details?.requestedOrgId).toBe('org-1');
      expect(body.details?.actualOrgId).toBe('org-2');
    });
  });

  describe('Project membership checks', () => {
    it('should return PROJECT_ACCESS_DENIED when user is not a project member', async () => {
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

      await seedUser({
        id: 'user-2',
        name: 'User 2',
        email: 'user2@example.com',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedProject({
        id: 'project-1',
        name: 'Test Project',
        orgId: 'org-1',
        createdBy: 'user-2',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      // Note: user-1 is org member but NOT project member

      const app = new Hono();
      app.get(
        '/orgs/:orgId/projects/:projectId/test',
        requireAuth,
        requireOrgMembership(),
        requireProjectAccess(),
        c => c.json({ success: true }),
      );

      const res = await fetchApp(app, '/orgs/org-1/projects/project-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(403);
      const body = await json(res);
      expect(body.code).toBe('PROJECT_ACCESS_DENIED');
      expect(body.details?.projectId).toBe('project-1');
      expect(body.details?.orgId).toBe('org-1');
    });

    it('should allow access when user is project member', async () => {
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

      await seedProject({
        id: 'project-1',
        name: 'Test Project',
        orgId: 'org-1',
        createdBy: 'user-1',
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

      const app = new Hono();
      app.get(
        '/orgs/:orgId/projects/:projectId/test',
        requireAuth,
        requireOrgMembership(),
        requireProjectAccess(),
        c => {
          const projectId = c.get('projectId');
          const projectRole = c.get('projectRole');
          return c.json({ success: true, projectId, projectRole });
        },
      );

      const res = await fetchApp(app, '/orgs/org-1/projects/project-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.success).toBe(true);
      expect(body.projectId).toBe('project-1');
      expect(body.projectRole).toBe('member');
    });
  });

  describe('Minimum project role enforcement', () => {
    it('should deny member when minRole is owner', async () => {
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

      await seedProject({
        id: 'project-1',
        name: 'Test Project',
        orgId: 'org-1',
        createdBy: 'user-1',
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

      const app = new Hono();
      app.get(
        '/orgs/:orgId/projects/:projectId/test',
        requireAuth,
        requireOrgMembership(),
        requireProjectAccess('owner'),
        c => c.json({ success: true }),
      );

      const res = await fetchApp(app, '/orgs/org-1/projects/project-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(403);
      const body = await json(res);
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('insufficient_project_role');
      expect(body.details?.required).toBe('owner');
      expect(body.details?.actual).toBe('member');
    });

    it('should allow owner when minRole is owner', async () => {
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

      await seedProject({
        id: 'project-1',
        name: 'Test Project',
        orgId: 'org-1',
        createdBy: 'user-1',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedProjectMember({
        id: 'pm-1',
        projectId: 'project-1',
        userId: 'user-1',
        role: 'owner',
        joinedAt: nowSec,
      });

      const app = new Hono();
      app.get(
        '/orgs/:orgId/projects/:projectId/test',
        requireAuth,
        requireOrgMembership(),
        requireProjectAccess('owner'),
        c => c.json({ success: true }),
      );

      const res = await fetchApp(app, '/orgs/org-1/projects/project-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.success).toBe(true);
    });
  });

  describe('Org roles and project roles are unrelated', () => {
    it('should deny org owner with project member role when minRole is owner', async () => {
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

      // User is org OWNER
      await seedOrgMember({
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'owner',
        createdAt: nowSec,
      });

      await seedUser({
        id: 'user-2',
        name: 'User 2',
        email: 'user2@example.com',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedProject({
        id: 'project-1',
        name: 'Test Project',
        orgId: 'org-1',
        createdBy: 'user-2',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      // But user is only project MEMBER (not owner)
      await seedProjectMember({
        id: 'pm-1',
        projectId: 'project-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: nowSec,
      });

      const app = new Hono();
      app.get(
        '/orgs/:orgId/projects/:projectId/test',
        requireAuth,
        requireOrgMembership(),
        requireProjectAccess('owner'),
        c => c.json({ success: true }),
      );

      const res = await fetchApp(app, '/orgs/org-1/projects/project-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      // Org owner role should NOT grant project owner access
      expect(res.status).toBe(403);
      const body = await json(res);
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('insufficient_project_role');
      expect(body.details?.required).toBe('owner');
      expect(body.details?.actual).toBe('member');
    });

    it('should allow org member with project owner role when minRole is owner', async () => {
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

      // User is only org MEMBER (not admin or owner)
      await seedOrgMember({
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'member',
        createdAt: nowSec,
      });

      await seedProject({
        id: 'project-1',
        name: 'Test Project',
        orgId: 'org-1',
        createdBy: 'user-1',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      // But user is project OWNER
      await seedProjectMember({
        id: 'pm-1',
        projectId: 'project-1',
        userId: 'user-1',
        role: 'owner',
        joinedAt: nowSec,
      });

      const app = new Hono();
      app.get(
        '/orgs/:orgId/projects/:projectId/test',
        requireAuth,
        requireOrgMembership(),
        requireProjectAccess('owner'),
        c => {
          const orgRole = c.get('orgRole');
          const projectRole = c.get('projectRole');
          return c.json({ success: true, orgRole, projectRole });
        },
      );

      const res = await fetchApp(app, '/orgs/org-1/projects/project-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      // Org member role should NOT block project owner access
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.success).toBe(true);
      expect(body.orgRole).toBe('member');
      expect(body.projectRole).toBe('owner');
    });

    it('should allow org admin with project member role when minRole is member', async () => {
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

      // User is org ADMIN
      await seedOrgMember({
        id: 'member-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'admin',
        createdAt: nowSec,
      });

      await seedUser({
        id: 'user-2',
        name: 'User 2',
        email: 'user2@example.com',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedProject({
        id: 'project-1',
        name: 'Test Project',
        orgId: 'org-1',
        createdBy: 'user-2',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      // But user is only project MEMBER
      await seedProjectMember({
        id: 'pm-1',
        projectId: 'project-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: nowSec,
      });

      const app = new Hono();
      app.get(
        '/orgs/:orgId/projects/:projectId/test',
        requireAuth,
        requireOrgMembership(),
        requireProjectAccess('member'),
        c => {
          const orgRole = c.get('orgRole');
          const projectRole = c.get('projectRole');
          return c.json({ success: true, orgRole, projectRole });
        },
      );

      const res = await fetchApp(app, '/orgs/org-1/projects/project-1/test', {
        headers: {
          'x-test-user-id': 'user-1',
          'x-test-user-email': 'user1@example.com',
        },
      });

      // Org admin role should NOT grant project access beyond membership
      // But project member role should satisfy minRole='member'
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.success).toBe(true);
      expect(body.orgRole).toBe('admin');
      expect(body.projectRole).toBe('member');
    });
  });
});
