import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import {
  buildUser,
  buildOrg,
  buildOrgMember,
  resetCounter,
  asUserId,
} from '@/__tests__/server/factories';
import { handleGet as listOrgsHandler, handlePost as createOrgHandler } from '../../orgs';
import { handlePut as updateOrgHandler, handleDelete as deleteOrgHandler } from '../$orgId';
import { handleGet as listMembersHandler, handlePost as addMemberHandler } from '../$orgId/members';
import {
  handlePut as updateMemberRoleHandler,
  handleDelete as removeMemberHandler,
} from '../$orgId/members/$memberId';
import { handler as setActiveHandler } from '../$orgId/set-active';

let currentUser: { id: string; email: string } = { id: 'user-1', email: 'user1@example.com' };

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => ({
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  }),
}));

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

function jsonReq(path: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/orgs', () => {
  it('creates org and returns 201', async () => {
    mockCreateOrganization.mockResolvedValueOnce({
      organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    });

    const res = await createOrgHandler({
      request: jsonReq('/api/orgs', 'POST', { name: 'Test Org', slug: 'test-org' }),
    });

    expect(res.status).toBe(201);
    expect(mockCreateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { name: 'Test Org', slug: 'test-org', logo: undefined, metadata: undefined },
    });
  });

  it('trims org name', async () => {
    mockCreateOrganization.mockResolvedValueOnce({
      organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    });

    const res = await createOrgHandler({
      request: jsonReq('/api/orgs', 'POST', { name: '  Test Org  ', slug: 'test-org' }),
    });

    expect(res.status).toBe(201);
    expect(mockCreateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: expect.objectContaining({ name: 'Test Org' }),
    });
  });

  it('returns 400 when name is missing', async () => {
    const res = await createOrgHandler({
      request: jsonReq('/api/orgs', 'POST', { slug: 'test-org' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_FIELD_REQUIRED');
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it('returns 403 when name is blank', async () => {
    const res = await createOrgHandler({
      request: jsonReq('/api/orgs', 'POST', { name: '   ', slug: 'test-org' }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('name_required');
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it('returns 403 when slug is taken', async () => {
    mockCreateOrganization.mockRejectedValueOnce(new Error('Organization slug is already taken'));

    const res = await createOrgHandler({
      request: jsonReq('/api/orgs', 'POST', { name: 'Test Org', slug: 'taken-slug' }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('slug_taken');
  });
});

describe('PUT /api/orgs/:orgId', () => {
  it('returns 403 when user is not org member', async () => {
    const user = await buildUser();
    const { org } = await buildOrg();
    currentUser = { id: user.id, email: user.email };

    const res = await updateOrgHandler({
      request: jsonReq(`/api/orgs/${org.id}`, 'PUT', { name: 'Updated Org' }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(403);
    expect(mockUpdateOrganization).not.toHaveBeenCalled();
  });

  it('returns 403 when user is member but not admin', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    const res = await updateOrgHandler({
      request: jsonReq(`/api/orgs/${org.id}`, 'PUT', { name: 'Updated Org' }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { details?: { reason?: string } };
    expect(body.details?.reason).toBe('insufficient_org_role');
    expect(mockUpdateOrganization).not.toHaveBeenCalled();
  });

  it('updates org when user is admin', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockUpdateOrganization.mockResolvedValueOnce({
      organization: { id: org.id, name: 'Updated Org', slug: 'test-org' },
    });

    const res = await updateOrgHandler({
      request: jsonReq(`/api/orgs/${org.id}`, 'PUT', { name: 'Updated Org', slug: 'test-org' }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(200);
    expect(mockUpdateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: org.id,
        data: { name: 'Updated Org', slug: 'test-org', logo: undefined, metadata: undefined },
      },
    });
  });

  it('returns 403 when slug is taken on update', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockUpdateOrganization.mockRejectedValueOnce(new Error('Organization slug is already taken'));

    const res = await updateOrgHandler({
      request: jsonReq(`/api/orgs/${org.id}`, 'PUT', { name: 'Updated Org', slug: 'taken-slug' }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('slug_taken');
  });
});

describe('DELETE /api/orgs/:orgId', () => {
  it('returns 403 when user is not owner', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    const res = await deleteOrgHandler({
      request: jsonReq(`/api/orgs/${org.id}`, 'DELETE'),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(403);
    expect(mockDeleteOrganization).not.toHaveBeenCalled();
  });

  it('deletes org when user is owner', async () => {
    const { org, owner } = await buildOrg();
    currentUser = { id: owner.id, email: owner.email };

    mockDeleteOrganization.mockResolvedValueOnce({});

    const res = await deleteOrgHandler({
      request: jsonReq(`/api/orgs/${org.id}`, 'DELETE'),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(200);
    expect(mockDeleteOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { organizationId: org.id },
    });
    const body = (await res.json()) as { success: boolean; deleted: string };
    expect(body.success).toBe(true);
    expect(body.deleted).toBe(org.id);
  });
});

describe('GET /api/orgs/:orgId/members', () => {
  it('returns 403 when user is not org member', async () => {
    const user = await buildUser();
    const { org } = await buildOrg();
    currentUser = { id: user.id, email: user.email };

    const res = await listMembersHandler({
      request: jsonReq(`/api/orgs/${org.id}/members`, 'GET'),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(403);
    expect(mockListMembers).not.toHaveBeenCalled();
  });

  it('lists members when user is org member', async () => {
    const { org } = await buildOrg();
    const { user: member, membership } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    mockListMembers.mockResolvedValueOnce({
      members: [{ id: membership.id, userId: member.id, role: 'member' }],
    });

    const res = await listMembersHandler({
      request: jsonReq(`/api/orgs/${org.id}/members`, 'GET'),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(200);
    expect(mockListMembers).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      query: { organizationId: org.id },
    });
  });
});

describe('POST /api/orgs/:orgId/members', () => {
  it('returns 403 when user is not admin', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    const res = await addMemberHandler({
      request: jsonReq(`/api/orgs/${org.id}/members`, 'POST', { userId: 'user-2', role: 'member' }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(403);
    expect(mockAddMember).not.toHaveBeenCalled();
  });

  it('returns 400 when userId is missing', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    const res = await addMemberHandler({
      request: jsonReq(`/api/orgs/${org.id}/members`, 'POST', { role: 'member' }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_FIELD_REQUIRED');
    expect(mockAddMember).not.toHaveBeenCalled();
  });

  it('adds member when user is admin', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    const userToAdd = await buildUser();
    currentUser = { id: admin.id, email: admin.email };

    mockAddMember.mockResolvedValueOnce({
      member: { id: 'member-new', userId: userToAdd.id, role: 'member' },
    });

    const res = await addMemberHandler({
      request: jsonReq(`/api/orgs/${org.id}/members`, 'POST', {
        userId: userToAdd.id,
        role: 'member',
      }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(201);
    expect(mockAddMember).toHaveBeenCalledWith({
      body: { organizationId: org.id, userId: userToAdd.id, role: 'member' },
      headers: expect.any(Headers),
    });
  });

  it('returns 403 when user is already a member', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockAddMember.mockRejectedValueOnce(new Error('User is already a member'));

    const res = await addMemberHandler({
      request: jsonReq(`/api/orgs/${org.id}/members`, 'POST', { userId: 'user-2', role: 'member' }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('already_member');
  });
});

describe('PUT /api/orgs/:orgId/members/:memberId', () => {
  it('returns 403 when user is not admin', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    const res = await updateMemberRoleHandler({
      request: jsonReq(`/api/orgs/${org.id}/members/member-2`, 'PUT', { role: 'admin' }),
      params: { orgId: org.id, memberId: asUserId('member-2') },
    });

    expect(res.status).toBe(403);
    expect(mockUpdateMemberRole).not.toHaveBeenCalled();
  });

  it('returns 400 when role is missing', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    const res = await updateMemberRoleHandler({
      request: jsonReq(`/api/orgs/${org.id}/members/member-2`, 'PUT', {}),
      params: { orgId: org.id, memberId: asUserId('member-2') },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/^VALIDATION_(FIELD_REQUIRED|INVALID_INPUT)$/);
    expect(mockUpdateMemberRole).not.toHaveBeenCalled();
  });

  it('updates member role when user is admin', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockUpdateMemberRole.mockResolvedValueOnce({});

    const res = await updateMemberRoleHandler({
      request: jsonReq(`/api/orgs/${org.id}/members/member-2`, 'PUT', { role: 'admin' }),
      params: { orgId: org.id, memberId: asUserId('member-2') },
    });

    expect(res.status).toBe(200);
    expect(mockUpdateMemberRole).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { organizationId: org.id, memberId: asUserId('member-2'), role: 'admin' },
    });
  });

  it('returns 403 when changing owner role requires owner', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockUpdateMemberRole.mockRejectedValueOnce(new Error('Only owners can change owner role'));

    const res = await updateMemberRoleHandler({
      request: jsonReq(`/api/orgs/${org.id}/members/member-2`, 'PUT', { role: 'owner' }),
      params: { orgId: org.id, memberId: asUserId('member-2') },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('owner_role_change_requires_owner');
  });
});

describe('DELETE /api/orgs/:orgId/members/:memberId', () => {
  it('returns 403 when non-admin tries to remove someone else', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    const res = await removeMemberHandler({
      request: jsonReq(`/api/orgs/${org.id}/members/member-2`, 'DELETE'),
      params: { orgId: org.id, memberId: asUserId('member-2') },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('cannot_remove_member');
    expect(mockRemoveMember).not.toHaveBeenCalled();
    expect(mockLeaveOrganization).not.toHaveBeenCalled();
  });

  it('uses leaveOrganization for self-removal', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    mockLeaveOrganization.mockResolvedValueOnce({});

    const res = await removeMemberHandler({
      request: jsonReq(`/api/orgs/${org.id}/members/${member.id}`, 'DELETE'),
      params: { orgId: org.id, memberId: member.id },
    });

    expect(res.status).toBe(200);
    expect(mockLeaveOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { organizationId: org.id },
    });
    expect(mockRemoveMember).not.toHaveBeenCalled();
    const body = (await res.json()) as { success: boolean; removed: string; isSelf: boolean };
    expect(body.success).toBe(true);
    expect(body.removed).toBe(member.id);
    expect(body.isSelf).toBe(true);
  });

  it('uses removeMember for admin removal', async () => {
    const { org } = await buildOrg();
    const { user: admin } = await buildOrgMember({ orgId: org.id, role: 'admin' });
    currentUser = { id: admin.id, email: admin.email };

    mockRemoveMember.mockResolvedValueOnce({});

    const res = await removeMemberHandler({
      request: jsonReq(`/api/orgs/${org.id}/members/member-2`, 'DELETE'),
      params: { orgId: org.id, memberId: asUserId('member-2') },
    });

    expect(res.status).toBe(200);
    expect(mockRemoveMember).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { organizationId: org.id, memberIdOrEmail: 'member-2' },
    });
    expect(mockLeaveOrganization).not.toHaveBeenCalled();
    const body = (await res.json()) as { success: boolean; removed: string; isSelf: boolean };
    expect(body.success).toBe(true);
    expect(body.removed).toBe('member-2');
    expect(body.isSelf).toBe(false);
  });

  it('returns 403 when trying to remove last owner', async () => {
    const { org, owner } = await buildOrg();
    currentUser = { id: owner.id, email: owner.email };

    mockLeaveOrganization.mockRejectedValueOnce(new Error('Cannot remove last owner'));

    const res = await removeMemberHandler({
      request: jsonReq(`/api/orgs/${org.id}/members/${owner.id}`, 'DELETE'),
      params: { orgId: org.id, memberId: owner.id },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('cannot_remove_last_owner');
  });
});

describe('POST /api/orgs/:orgId/set-active', () => {
  it('returns 403 when user is not org member', async () => {
    const user = await buildUser();
    const { org } = await buildOrg();
    currentUser = { id: user.id, email: user.email };

    const res = await setActiveHandler({
      request: jsonReq(`/api/orgs/${org.id}/set-active`, 'POST'),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(403);
    expect(mockSetActiveOrganization).not.toHaveBeenCalled();
  });

  it('sets active org when user is org member', async () => {
    const { org } = await buildOrg();
    const { user: member } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: member.id, email: member.email };

    mockSetActiveOrganization.mockResolvedValueOnce({});

    const res = await setActiveHandler({
      request: jsonReq(`/api/orgs/${org.id}/set-active`, 'POST'),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(200);
    expect(mockSetActiveOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { organizationId: org.id },
    });
    const body = (await res.json()) as { success: boolean; activeOrganizationId: string };
    expect(body.success).toBe(true);
    expect(body.activeOrganizationId).toBe(org.id);
  });
});

// List orgs test (plain pass-through)
describe('GET /api/orgs', () => {
  it('returns list from better-auth api', async () => {
    mockListOrganizations.mockResolvedValueOnce([]);

    const res = await listOrgsHandler({ request: jsonReq('/api/orgs', 'GET') });

    expect(res.status).toBe(200);
    expect(mockListOrganizations).toHaveBeenCalled();
  });
});
