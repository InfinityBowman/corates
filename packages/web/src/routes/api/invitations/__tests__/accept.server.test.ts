import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import {
  buildProject,
  buildProjectWithMembers,
  buildProjectInvitation,
  buildUser,
  resetCounter,
} from '@/__tests__/server/factories';
import { createDb } from '@corates/db/client';
import { projectInvitations, projectMembers, member } from '@corates/db/schema';
import { eq, and } from 'drizzle-orm';
import { handler as acceptHandler } from '../accept';

let currentUser: { id: string; email: string } = { id: 'user-1', email: 'user1@example.com' };

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => ({
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  }),
}));

vi.mock('@corates/workers/project-sync', () => ({
  syncMemberToDO: vi.fn(async () => {}),
}));

vi.mock('@corates/workers/billing-resolver', () => ({
  resolveOrgAccess: vi.fn(),
}));

let mockResolveOrgAccess: Mock;
let mockSyncMemberToDO: Mock;

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearProjectDOs(['project-1']);
  vi.clearAllMocks();
  currentUser = { id: 'user-1', email: 'user1@example.com' };

  const billingResolver = await import('@corates/workers/billing-resolver');
  mockResolveOrgAccess = billingResolver.resolveOrgAccess as unknown as Mock;

  const projectSync = await import('@corates/workers/project-sync');
  mockSyncMemberToDO = projectSync.syncMemberToDO as unknown as Mock;

  mockResolveOrgAccess.mockResolvedValue({
    accessMode: 'write',
    quotas: {
      'projects.max': 10,
      'collaborators.org.max': -1,
    },
    entitlements: { 'project.create': true },
  });

  mockSyncMemberToDO.mockResolvedValue(undefined);
});

function jsonReq(body?: unknown): Request {
  return new Request('http://localhost/api/invitations/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/invitations/accept', () => {
  it('should accept invitation and add user to org and project', async () => {
    const { project, org, owner } = await buildProject();
    const invitee = await buildUser({ email: 'invitee@example.com' });
    const token = 'accept-token';

    const invitation = await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: invitee.email,
      token,
      invitedBy: owner.id,
      status: 'pending',
    });

    currentUser = { id: invitee.id, email: invitee.email };

    const res = await acceptHandler({ request: jsonReq({ token }) });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      orgId: string;
      projectId: string;
      role: string;
    };
    expect(body.success).toBe(true);
    expect(body.orgId).toBe(org.id);
    expect(body.projectId).toBe(project.id);
    expect(body.role).toBe('member');

    const db = createDb(env.DB);
    const orgMember = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, org.id), eq(member.userId, invitee.id)))
      .get();
    expect(orgMember).toBeDefined();
    expect(orgMember!.role).toBe('member');

    const projectMember = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, invitee.id)))
      .get();
    expect(projectMember).toBeDefined();
    expect(projectMember!.role).toBe('member');

    const dbInvitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.id, invitation.id))
      .get();
    expect(dbInvitation!.acceptedAt).not.toBeNull();

    expect(mockSyncMemberToDO).toHaveBeenCalledWith(
      expect.any(Object),
      project.id,
      'add',
      expect.objectContaining({ userId: invitee.id, role: 'member' }),
    );
  });

  it('should return error for invalid token', async () => {
    const { owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await acceptHandler({ request: jsonReq({ token: 'invalid-token' }) });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/FIELD_INVALID_FORMAT/);
  });

  it('should return error for expired invitation', async () => {
    const { project, org, owner } = await buildProject();
    const invitee = await buildUser({ email: 'invitee@example.com' });
    const token = 'expired-token';

    await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: invitee.email,
      token,
      invitedBy: owner.id,
      status: 'expired',
    });

    currentUser = { id: invitee.id, email: invitee.email };

    const res = await acceptHandler({ request: jsonReq({ token }) });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; details?: { value?: string } };
    expect(body.code).toMatch(/FIELD_INVALID_FORMAT/);
    expect(body.details?.value).toBe('expired');
  });

  it('should return error for email mismatch', async () => {
    const { project, org, owner } = await buildProject();
    const differentUser = await buildUser({ email: 'different@example.com' });
    const token = 'token-1';

    await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'invitee@example.com',
      token,
      invitedBy: owner.id,
      status: 'pending',
    });

    currentUser = { id: differentUser.id, email: differentUser.email };

    const res = await acceptHandler({ request: jsonReq({ token }) });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('email_mismatch');
  });

  it('should mark invitation as accepted if user is already project member', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    const existingMember = members[1].user;
    const token = 'token-1';

    const invitation = await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: existingMember.email,
      token,
      invitedBy: owner.id,
      status: 'pending',
    });

    currentUser = { id: existingMember.id, email: existingMember.email };

    const res = await acceptHandler({ request: jsonReq({ token }) });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; alreadyMember: boolean };
    expect(body.success).toBe(true);
    expect(body.alreadyMember).toBe(true);

    const db = createDb(env.DB);
    const dbInvitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.id, invitation.id))
      .get();
    expect(dbInvitation!.acceptedAt).not.toBeNull();

    const projectMembersList = await db
      .select()
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, existingMember.id)),
      )
      .all();
    expect(projectMembersList).toHaveLength(1);
  });

  it('should return error when quota exceeded', async () => {
    const { project, org, owner } = await buildProject();
    const invitee = await buildUser({ email: 'invitee@example.com' });
    const token = 'token-1';

    await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: invitee.email,
      token,
      invitedBy: owner.id,
      status: 'pending',
    });

    mockResolveOrgAccess.mockResolvedValueOnce({
      accessMode: 'write',
      quotas: { 'collaborators.org.max': 0 },
      entitlements: {},
    });

    currentUser = { id: invitee.id, email: invitee.email };

    const res = await acceptHandler({ request: jsonReq({ token }) });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('quota_exceeded');

    const db = createDb(env.DB);
    const orgMember = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, org.id), eq(member.userId, invitee.id)))
      .get();
    expect(orgMember).toBeUndefined();

    const projectMember = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, invitee.id)))
      .get();
    expect(projectMember).toBeUndefined();
  });
});
