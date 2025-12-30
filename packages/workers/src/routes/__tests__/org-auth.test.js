/**
 * Integration tests for org-scoped authorization
 * Tests:
 * - Former org member access denial (HTTP routes + WebSocket)
 * - Cross-org projectId mismatch (PROJECT_NOT_IN_ORG error)
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  clearProjectDOs,
  seedUser,
  seedProject,
  seedProjectMember,
  seedOrgMember,
  seedOrganization,
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

let app;

// Track which user the mock auth should use
let mockUserId = 'user-1';
let mockUserEmail = 'user1@example.com';

// Mock auth middleware
vi.mock('../../middleware/auth.js', () => {
  return {
    requireAuth: async (c, next) => {
      const userId = c.req.raw.headers.get('x-test-user-id') || mockUserId;
      const email = c.req.raw.headers.get('x-test-user-email') || mockUserEmail;
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

beforeAll(async () => {
  const indexModule = await import('../../index.js');
  app = indexModule.default;
});

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs(['project-1', 'project-2']);
  mockUserId = 'user-1';
  mockUserEmail = 'user1@example.com';
});

async function fetchOrgProject(orgId, projectId, path = '', init = {}) {
  const ctx = createExecutionContext();
  const url = `/api/orgs/${orgId}/projects${projectId ? `/${projectId}` : ''}${path}`;
  const req = new Request(`http://localhost${url}`, {
    ...init,
    headers: {
      'x-test-user-id': init.userId || 'user-1',
      'x-test-user-email': init.email || 'user1@example.com',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Org Authorization - Former Org Member', () => {
  it('should deny HTTP access after user is removed from org', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    // Seed users
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Seed organization
    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    // Seed project in org
    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Seed user as project member
    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    // Note: User is NOT an org member - simulate removed from org
    // When org membership is missing, access should be denied

    const res = await fetchOrgProject('org-1', 'project-1');
    expect(res.status).toBe(403);

    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('not_org_member');
  });

  it('should allow HTTP access when user is an org member', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    // Seed users
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Seed organization
    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    // Add user to organization
    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'member',
      createdAt: nowSec,
    });

    // Seed project in org
    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Seed user as project member
    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const res = await fetchOrgProject('org-1', 'project-1');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.id).toBe('project-1');
    expect(body.name).toBe('Test Project');
    expect(body.role).toBe('owner');
  });

  it('should deny access when user has org membership but not project membership', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    // Seed users (need both to have project createdBy user-2)
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

    // Seed organization
    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    // Add user-1 to organization (but not user-2)
    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'member',
      createdAt: nowSec,
    });

    // Seed project in org created by user-2 (user-1 is NOT a project member)
    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      orgId: 'org-1',
      createdBy: 'user-2',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchOrgProject('org-1', 'project-1');
    expect(res.status).toBe(403);

    const body = await json(res);
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });
});

describe('Org Authorization - Cross-Org Project ID Mismatch', () => {
  it('should return PROJECT_NOT_IN_ORG when projectId belongs to different org', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    // Seed user
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Seed two organizations
    await seedOrganization({
      id: 'org-a',
      name: 'Org A',
      slug: 'org-a',
      createdAt: nowSec,
    });

    await seedOrganization({
      id: 'org-b',
      name: 'Org B',
      slug: 'org-b',
      createdAt: nowSec,
    });

    // Add user to both organizations
    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-a',
      userId: 'user-1',
      role: 'member',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-2',
      organizationId: 'org-b',
      userId: 'user-1',
      role: 'member',
      createdAt: nowSec,
    });

    // Create project in Org A
    await seedProject({
      id: 'project-in-org-a',
      name: 'Project in Org A',
      orgId: 'org-a',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Add user as project member in Org A
    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-in-org-a',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    // Try to access project-in-org-a via org-b path
    // Should return PROJECT_NOT_IN_ORG (403), not 404
    const res = await fetchOrgProject('org-b', 'project-in-org-a');
    expect(res.status).toBe(403);

    const body = await json(res);
    expect(body.code).toBe('PROJECT_NOT_IN_ORG');
    expect(body.details?.projectId).toBe('project-in-org-a');
    expect(body.details?.requestedOrgId).toBe('org-b');
    expect(body.details?.actualOrgId).toBe('org-a');
  });

  it('should return PROJECT_NOT_FOUND when project does not exist', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    // Seed user
    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // Seed organization
    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    // Add user to organization
    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'member',
      createdAt: nowSec,
    });

    // Try to access a non-existent project
    const res = await fetchOrgProject('org-1', 'nonexistent-project');
    expect(res.status).toBe(404);

    const body = await json(res);
    expect(body.code).toBe('PROJECT_NOT_FOUND');
  });
});

describe('Org Authorization - Legacy Routes Return 410', () => {
  it('should return 410 Gone for legacy /api/projects routes', async () => {
    const ctx = createExecutionContext();
    const req = new Request('http://localhost/api/projects/any-project', {
      headers: {
        'x-test-user-id': 'user-1',
      },
    });
    const res = await app.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(410);
    const body = await json(res);
    expect(body.error).toBe('ENDPOINT_MOVED');
    expect(body.message).toContain('/api/orgs/:orgId/projects/');
  });

  it('should return 410 Gone for legacy /api/invitations routes', async () => {
    const ctx = createExecutionContext();
    const req = new Request('http://localhost/api/invitations/accept', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-1',
      },
      body: JSON.stringify({ token: 'test-token' }),
    });
    const res = await app.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(410);
    const body = await json(res);
    expect(body.error).toBe('ENDPOINT_MOVED');
  });
});
