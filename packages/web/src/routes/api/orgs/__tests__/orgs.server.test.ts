import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import {
  buildUser,
  buildOrg,
  buildOrgMember,
  resetCounter,
  asUserId,
} from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import {
  listOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  listOrgMembers,
  addOrgMember,
  updateMemberRole,
  removeMember,
  setActiveOrg,
} from '@/server/functions/orgs.server';

let currentUser: { id: string; email: string } = { id: 'user-1', email: 'user1@example.com' };

function mockSession(overrides?: { userId?: string; email?: string }): Session {
  return {
    user: {
      id: overrides?.userId ?? currentUser.id,
      email: overrides?.email ?? currentUser.email,
      name: 'Test User',
    },
    session: {
      id: 'test-session',
      userId: overrides?.userId ?? currentUser.id,
    },
  } as Session;
}

const dummyRequest = new Request('http://localhost');

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

vi.mock('@corates/workers/auth-config', () => ({
  createAuth: () => ({
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
  }),
}));

vi.mock('@corates/workers/billing-resolver', () => ({
  resolveOrgAccess: vi.fn(async () => ({
    accessMode: 'write',
    source: 'free',
    quotas: { 'projects.max': 10, 'collaborators.org.max': 50 },
    entitlements: { 'project.create': true },
  })),
}));

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  vi.clearAllMocks();
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

describe('createOrganization', () => {
  it('creates org', async () => {
    mockCreateOrganization.mockResolvedValueOnce({
      organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    });

    const result = await createOrganization(dummyRequest, {
      name: 'Test Org',
      slug: 'test-org',
    });

    expect(result).toEqual({
      organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    });
    expect(mockCreateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { name: 'Test Org', slug: 'test-org', logo: undefined, metadata: undefined },
    });
  });

  it('throws 403 when slug is taken', async () => {
    mockCreateOrganization.mockRejectedValueOnce(
      new Error('Organization slug is already taken'),
    );

    try {
      await createOrganization(dummyRequest, { name: 'Test Org', slug: 'taken-slug' });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('slug_taken');
    }
  });
});

describe('updateOrganization', () => {
  it('throws 403 when user is not org member', async () => {
    const user = await buildUser();
    const { org } = await buildOrg();
    currentUser = { id: user.id, email: user.email };

    try {
      await updateOrganization(mockSession(), createDb(env.DB), dummyRequest, org.id, {
        name: 'Updated Org',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      expect(mockUpdateOrganization).not.toHaveBeenCalled();
    }
  });

  it('throws 403 when user is member but not admin', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    try {
      await updateOrganization(mockSession(), createDb(env.DB), dummyRequest, org.id, {
        name: 'Updated Org',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { details?: { reason?: string } };
      expect(body.details?.reason).toBe('insufficient_org_role');
      expect(mockUpdateOrganization).not.toHaveBeenCalled();
    }
  });

  it('updates org when user is admin', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockUpdateOrganization.mockResolvedValueOnce({
      organization: { id: org.id, name: 'Updated Org', slug: 'test-org' },
    });

    const result = await updateOrganization(
      mockSession(),
      createDb(env.DB),
      dummyRequest,
      org.id,
      { name: 'Updated Org', slug: 'test-org' },
    );

    expect(result.success).toBe(true);
    expect(mockUpdateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: org.id,
        data: { name: 'Updated Org', slug: 'test-org', logo: undefined, metadata: undefined },
      },
    });
  });

  it('throws 403 when slug is taken on update', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockUpdateOrganization.mockRejectedValueOnce(
      new Error('Organization slug is already taken'),
    );

    try {
      await updateOrganization(mockSession(), createDb(env.DB), dummyRequest, org.id, {
        name: 'Updated Org',
        slug: 'taken-slug',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('slug_taken');
    }
  });
});

describe('deleteOrganization', () => {
  it('throws 403 when user is not owner', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    try {
      await deleteOrganization(mockSession(), createDb(env.DB), dummyRequest, org.id);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      expect(mockDeleteOrganization).not.toHaveBeenCalled();
    }
  });

  it('deletes org when user is owner', async () => {
    const { org, owner } = await buildOrg();
    currentUser = { id: owner.id, email: owner.email };

    mockDeleteOrganization.mockResolvedValueOnce({});

    const result = await deleteOrganization(mockSession(), createDb(env.DB), dummyRequest, org.id);

    expect(result.success).toBe(true);
    expect(result.deleted).toBe(org.id);
    expect(mockDeleteOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { organizationId: org.id },
    });
  });
});

describe('listOrgMembers', () => {
  it('throws 403 when user is not org member', async () => {
    const user = await buildUser();
    const { org } = await buildOrg();
    currentUser = { id: user.id, email: user.email };

    try {
      await listOrgMembers(mockSession(), createDb(env.DB), dummyRequest, org.id);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      expect(mockListMembers).not.toHaveBeenCalled();
    }
  });

  it('lists members when user is org member', async () => {
    const { org } = await buildOrg();
    const { user: member, membership } = await buildOrgMember({
      orgId: org.id,
      role: 'member',
    });
    currentUser = { id: member.id, email: member.email };

    mockListMembers.mockResolvedValueOnce({
      members: [{ id: membership.id, userId: member.id, role: 'member' }],
    });

    const result = await listOrgMembers(mockSession(), createDb(env.DB), dummyRequest, org.id);

    expect(result).toEqual({
      members: [{ id: membership.id, userId: member.id, role: 'member' }],
    });
    expect(mockListMembers).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      query: { organizationId: org.id },
    });
  });
});

describe('addOrgMember', () => {
  it('throws 403 when user is not admin', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    try {
      await addOrgMember(mockSession(), createDb(env.DB), dummyRequest, org.id, {
        userId: 'user-2',
        role: 'member',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      expect(mockAddMember).not.toHaveBeenCalled();
    }
  });

  it('adds member when user is admin', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    const userToAdd = await buildUser();
    currentUser = { id: admin.id, email: admin.email };

    mockAddMember.mockResolvedValueOnce({
      member: { id: 'member-new', userId: userToAdd.id, role: 'member' },
    });

    const result = await addOrgMember(mockSession(), createDb(env.DB), dummyRequest, org.id, {
      userId: userToAdd.id,
      role: 'member',
    });

    expect(result.success).toBe(true);
    expect(mockAddMember).toHaveBeenCalledWith({
      body: { organizationId: org.id, userId: userToAdd.id, role: 'member' },
      headers: expect.any(Headers),
    });
  });

  it('throws 403 when user is already a member', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockAddMember.mockRejectedValueOnce(new Error('User is already a member'));

    try {
      await addOrgMember(mockSession(), createDb(env.DB), dummyRequest, org.id, {
        userId: 'user-2',
        role: 'member',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('already_member');
    }
  });
});

describe('updateMemberRole', () => {
  it('throws 403 when user is not admin', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    try {
      await updateMemberRole(
        mockSession(),
        createDb(env.DB),
        dummyRequest,
        org.id,
        asUserId('member-2'),
        { role: 'admin' },
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      expect(mockUpdateMemberRole).not.toHaveBeenCalled();
    }
  });

  it('updates member role when user is admin', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockUpdateMemberRole.mockResolvedValueOnce({});

    const result = await updateMemberRole(
      mockSession(),
      createDb(env.DB),
      dummyRequest,
      org.id,
      asUserId('member-2'),
      { role: 'admin' },
    );

    expect(result.success).toBe(true);
    expect(result.role).toBe('admin');
    expect(mockUpdateMemberRole).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { organizationId: org.id, memberId: asUserId('member-2'), role: 'admin' },
    });
  });

  it('throws 403 when changing owner role requires owner', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockUpdateMemberRole.mockRejectedValueOnce(
      new Error('Only owners can change owner role'),
    );

    try {
      await updateMemberRole(
        mockSession(),
        createDb(env.DB),
        dummyRequest,
        org.id,
        asUserId('member-2'),
        { role: 'owner' },
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('owner_role_change_requires_owner');
    }
  });
});

describe('removeMember', () => {
  it('throws 403 when non-admin tries to remove someone else', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    try {
      await removeMember(
        mockSession(),
        createDb(env.DB),
        dummyRequest,
        org.id,
        asUserId('member-2'),
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('cannot_remove_member');
      expect(mockRemoveMember).not.toHaveBeenCalled();
      expect(mockLeaveOrganization).not.toHaveBeenCalled();
    }
  });

  it('uses leaveOrganization for self-removal', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    mockLeaveOrganization.mockResolvedValueOnce({});

    const result = await removeMember(
      mockSession(),
      createDb(env.DB),
      dummyRequest,
      org.id,
      member.id,
    );

    expect(result.success).toBe(true);
    expect(result.removed).toBe(member.id);
    expect(result.isSelf).toBe(true);
    expect(mockLeaveOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { organizationId: org.id },
    });
    expect(mockRemoveMember).not.toHaveBeenCalled();
  });

  it('uses removeMember for admin removal', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockRemoveMember.mockResolvedValueOnce({});

    const result = await removeMember(
      mockSession(),
      createDb(env.DB),
      dummyRequest,
      org.id,
      asUserId('member-2'),
    );

    expect(result.success).toBe(true);
    expect(result.removed).toBe('member-2');
    expect(result.isSelf).toBe(false);
    expect(mockRemoveMember).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { organizationId: org.id, memberIdOrEmail: 'member-2' },
    });
    expect(mockLeaveOrganization).not.toHaveBeenCalled();
  });

  it('throws 403 when trying to remove last owner', async () => {
    const { org, owner } = await buildOrg();
    currentUser = { id: owner.id, email: owner.email };

    mockLeaveOrganization.mockRejectedValueOnce(new Error('Cannot remove last owner'));

    try {
      await removeMember(mockSession(), createDb(env.DB), dummyRequest, org.id, owner.id);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('cannot_remove_last_owner');
    }
  });
});

describe('setActiveOrg', () => {
  it('throws 403 when user is not org member', async () => {
    const user = await buildUser();
    const { org } = await buildOrg();
    currentUser = { id: user.id, email: user.email };

    try {
      await setActiveOrg(mockSession(), createDb(env.DB), dummyRequest, org.id);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      expect(mockSetActiveOrganization).not.toHaveBeenCalled();
    }
  });

  it('sets active org when user is org member', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    mockSetActiveOrganization.mockResolvedValueOnce({});

    const result = await setActiveOrg(mockSession(), createDb(env.DB), dummyRequest, org.id);

    expect(result.success).toBe(true);
    expect(result.activeOrganizationId).toBe(org.id);
    expect(mockSetActiveOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { organizationId: org.id },
    });
  });
});

describe('listOrganizations', () => {
  it('returns list from better-auth api', async () => {
    mockListOrganizations.mockResolvedValueOnce([]);

    const result = await listOrganizations(dummyRequest);

    expect(result).toEqual([]);
    expect(mockListOrganizations).toHaveBeenCalled();
  });
});
