/**
 * Integration tests for org management API routes
 * Tests Better Auth delegation layer for organization operations
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedOrganization,
  seedOrgMember,
  json,
} from '@/__tests__/helpers.js';

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

// Mock Better Auth createAuth to return spyable API methods
const mockCreateOrganization = vi.fn();
const mockGetFullOrganization = vi.fn();
const mockUpdateOrganization = vi.fn();
const mockDeleteOrganization = vi.fn();
const mockListOrganizations = vi.fn();
const mockListMembers = vi.fn();
const mockAddMember = vi.fn();
const mockUpdateMemberRole = vi.fn();
const mockRemoveMember = vi.fn();
const mockLeaveOrganization = vi.fn();
const mockSetActiveOrganization = vi.fn();

vi.mock('@/auth/config.js', () => {
  return {
    createAuth: () => {
      return {
        api: {
          createOrganization: mockCreateOrganization,
          getFullOrganization: mockGetFullOrganization,
          updateOrganization: mockUpdateOrganization,
          deleteOrganization: mockDeleteOrganization,
          listOrganizations: mockListOrganizations,
          listMembers: mockListMembers,
          addMember: mockAddMember,
          updateMemberRole: mockUpdateMemberRole,
          removeMember: mockRemoveMember,
          leaveOrganization: mockLeaveOrganization,
          setActiveOrganization: mockSetActiveOrganization,
        },
      };
    },
  };
});

// Mock billing resolver to return write access for all orgs
vi.mock('@/lib/billingResolver.js', () => {
  return {
    resolveOrgAccess: vi.fn(async () => ({
      accessMode: 'write',
      quotas: {
        'projects.max': 10,
        'collaborators.org.max': 50,
      },
      entitlements: {
        'project.create': true,
      },
    })),
  };
});

let app;

beforeAll(async () => {
  const { orgRoutes } = await import('../orgs/index.js');
  app = new Hono();
  app.route('/api/orgs', orgRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

async function fetchOrgs(path, init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      'x-test-user-id': 'user-1',
      'x-test-user-email': 'user1@example.com',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Org Management API - POST /api/orgs', () => {
  it('should create org and return 201', async () => {
    mockCreateOrganization.mockResolvedValueOnce({
      organization: {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
      },
    });

    const res = await fetchOrgs('/api/orgs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test Org', slug: 'test-org' }),
    });

    expect(res.status).toBe(201);
    expect(mockCreateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        name: 'Test Org',
        slug: 'test-org',
        logo: undefined,
        metadata: undefined,
      },
    });
  });

  it('should trim org name', async () => {
    mockCreateOrganization.mockResolvedValueOnce({
      organization: {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
      },
    });

    const res = await fetchOrgs('/api/orgs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  Test Org  ', slug: 'test-org' }),
    });

    expect(res.status).toBe(201);
    expect(mockCreateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: expect.objectContaining({
        name: 'Test Org',
      }),
    });
  });

  it('should return 400 when name is missing', async () => {
    const res = await fetchOrgs('/api/orgs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'test-org' }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_FIELD_REQUIRED');
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it('should return 403 when name is blank', async () => {
    const res = await fetchOrgs('/api/orgs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '   ', slug: 'test-org' }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('name_required');
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it('should return 403 when slug is taken', async () => {
    mockCreateOrganization.mockRejectedValueOnce(new Error('Organization slug is already taken'));

    const res = await fetchOrgs('/api/orgs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test Org', slug: 'taken-slug' }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('slug_taken');
  });
});

describe('Org Management API - PUT /api/orgs/:orgId', () => {
  it('should return 403 when user is not org member', async () => {
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

    const res = await fetchOrgs('/api/orgs/org-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Org' }),
    });

    expect(res.status).toBe(403);
    expect(mockUpdateOrganization).not.toHaveBeenCalled();
  });

  it('should return 403 when user is member but not admin', async () => {
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

    const res = await fetchOrgs('/api/orgs/org-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Org' }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.details?.reason).toBe('insufficient_org_role');
    expect(mockUpdateOrganization).not.toHaveBeenCalled();
  });

  it('should update org when user is admin', async () => {
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

    mockUpdateOrganization.mockResolvedValueOnce({
      organization: {
        id: 'org-1',
        name: 'Updated Org',
        slug: 'test-org',
      },
    });

    const res = await fetchOrgs('/api/orgs/org-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Org', slug: 'test-org' }),
    });

    expect(res.status).toBe(200);
    expect(mockUpdateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: 'org-1',
        data: {
          name: 'Updated Org',
          slug: 'test-org',
          logo: undefined,
          metadata: undefined,
        },
      },
    });
  });

  it('should return 403 when slug is taken on update', async () => {
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

    mockUpdateOrganization.mockRejectedValueOnce(new Error('Organization slug is already taken'));

    const res = await fetchOrgs('/api/orgs/org-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Org', slug: 'taken-slug' }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('slug_taken');
  });
});

describe('Org Management API - DELETE /api/orgs/:orgId', () => {
  it('should return 403 when user is not owner', async () => {
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

    const res = await fetchOrgs('/api/orgs/org-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(403);
    expect(mockDeleteOrganization).not.toHaveBeenCalled();
  });

  it('should delete org when user is owner', async () => {
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

    mockDeleteOrganization.mockResolvedValueOnce({});

    const res = await fetchOrgs('/api/orgs/org-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    expect(mockDeleteOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: 'org-1',
      },
    });
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.deleted).toBe('org-1');
  });
});

describe('Org Management API - GET /api/orgs/:orgId/members', () => {
  it('should return 403 when user is not org member', async () => {
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

    const res = await fetchOrgs('/api/orgs/org-1/members');

    expect(res.status).toBe(403);
    expect(mockListMembers).not.toHaveBeenCalled();
  });

  it('should list members when user is org member', async () => {
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

    mockListMembers.mockResolvedValueOnce({
      members: [
        {
          id: 'member-1',
          userId: 'user-1',
          role: 'member',
        },
      ],
    });

    const res = await fetchOrgs('/api/orgs/org-1/members');

    expect(res.status).toBe(200);
    expect(mockListMembers).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      query: {
        organizationId: 'org-1',
      },
    });
  });
});

describe('Org Management API - POST /api/orgs/:orgId/members', () => {
  it('should return 403 when user is not admin', async () => {
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

    const res = await fetchOrgs('/api/orgs/org-1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user-2', role: 'member' }),
    });

    expect(res.status).toBe(403);
    expect(mockAddMember).not.toHaveBeenCalled();
  });

  it('should return 400 when userId is missing', async () => {
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

    const res = await fetchOrgs('/api/orgs/org-1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'member' }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_FIELD_REQUIRED');
    expect(mockAddMember).not.toHaveBeenCalled();
  });

  it('should add member when user is admin', async () => {
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

    mockAddMember.mockResolvedValueOnce({
      member: {
        id: 'member-2',
        userId: 'user-2',
        role: 'member',
      },
    });

    const res = await fetchOrgs('/api/orgs/org-1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user-2', role: 'member' }),
    });

    expect(res.status).toBe(201);
    expect(mockAddMember).toHaveBeenCalledWith({
      body: {
        organizationId: 'org-1',
        userId: 'user-2',
        role: 'member',
      },
      headers: expect.any(Headers),
    });
  });

  it('should return 403 when user is already a member', async () => {
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

    mockAddMember.mockRejectedValueOnce(new Error('User is already a member'));

    const res = await fetchOrgs('/api/orgs/org-1/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user-2', role: 'member' }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('already_member');
  });
});

describe('Org Management API - PUT /api/orgs/:orgId/members/:memberId', () => {
  it('should return 403 when user is not admin', async () => {
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

    const res = await fetchOrgs('/api/orgs/org-1/members/member-2', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });

    expect(res.status).toBe(403);
    expect(mockUpdateMemberRole).not.toHaveBeenCalled();
  });

  it('should return 400 when role is missing', async () => {
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

    const res = await fetchOrgs('/api/orgs/org-1/members/member-2', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_FIELD_REQUIRED');
    expect(mockUpdateMemberRole).not.toHaveBeenCalled();
  });

  it('should update member role when user is admin', async () => {
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

    mockUpdateMemberRole.mockResolvedValueOnce({});

    const res = await fetchOrgs('/api/orgs/org-1/members/member-2', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });

    expect(res.status).toBe(200);
    expect(mockUpdateMemberRole).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: 'org-1',
        memberId: 'member-2',
        role: 'admin',
      },
    });
  });

  it('should return 403 when changing owner role requires owner', async () => {
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

    mockUpdateMemberRole.mockRejectedValueOnce(new Error('Only owners can change owner role'));

    const res = await fetchOrgs('/api/orgs/org-1/members/member-2', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'owner' }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('owner_role_change_requires_owner');
  });
});

describe('Org Management API - DELETE /api/orgs/:orgId/members/:memberId', () => {
  it('should return 403 when non-admin tries to remove someone else', async () => {
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

    const res = await fetchOrgs('/api/orgs/org-1/members/member-2', {
      method: 'DELETE',
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('cannot_remove_member');
    expect(mockRemoveMember).not.toHaveBeenCalled();
    expect(mockLeaveOrganization).not.toHaveBeenCalled();
  });

  it('should use leaveOrganization for self-removal', async () => {
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

    mockLeaveOrganization.mockResolvedValueOnce({});

    const res = await fetchOrgs('/api/orgs/org-1/members/user-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    expect(mockLeaveOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: 'org-1',
      },
    });
    expect(mockRemoveMember).not.toHaveBeenCalled();
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.removed).toBe('user-1');
    expect(body.isSelf).toBe(true);
  });

  it('should use removeMember for admin removal', async () => {
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

    mockRemoveMember.mockResolvedValueOnce({});

    const res = await fetchOrgs('/api/orgs/org-1/members/member-2', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    expect(mockRemoveMember).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: 'org-1',
        memberIdOrEmail: 'member-2',
      },
    });
    expect(mockLeaveOrganization).not.toHaveBeenCalled();
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.removed).toBe('member-2');
    expect(body.isSelf).toBe(false);
  });

  it('should return 403 when trying to remove last owner', async () => {
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

    mockLeaveOrganization.mockRejectedValueOnce(new Error('Cannot remove last owner'));

    const res = await fetchOrgs('/api/orgs/org-1/members/user-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('cannot_remove_last_owner');
  });
});

describe('Org Management API - POST /api/orgs/:orgId/set-active', () => {
  it('should return 403 when user is not org member', async () => {
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

    const res = await fetchOrgs('/api/orgs/org-1/set-active', {
      method: 'POST',
    });

    expect(res.status).toBe(403);
    expect(mockSetActiveOrganization).not.toHaveBeenCalled();
  });

  it('should set active org when user is org member', async () => {
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

    mockSetActiveOrganization.mockResolvedValueOnce({});

    const res = await fetchOrgs('/api/orgs/org-1/set-active', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(mockSetActiveOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: 'org-1',
      },
    });
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.activeOrganizationId).toBe('org-1');
  });
});
