import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { createDb } from '@corates/db/client';
import { projectInvitations } from '@corates/db/schema';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import {
  buildProject,
  buildProjectInvitation,
  resetCounter,
  asProjectInvitationId,
} from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import {
  listProjectInvitations,
  createProjectInvitation,
  cancelProjectInvitation,
} from '@/server/functions/org-projects.server';

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

vi.mock('@corates/workers/billing-resolver', () => ({
  resolveOrgAccess: vi.fn(async () => ({
    accessMode: 'write',
    source: 'free',
    quotas: { 'projects.max': 10, 'collaborators.org.max': -1 },
    entitlements: { 'project.create': true },
  })),
}));

vi.mock('postmark', () => ({
  Client: class {
    constructor() {}
    sendEmail() {
      return Promise.resolve({ Message: 'mock' });
    }
  },
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs(['project-1']);
  vi.clearAllMocks();
  resetCounter();
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

describe('createProjectInvitation', () => {
  it('creates a new invitation', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const result = await createProjectInvitation(
      mockSession(),
      createDb(env.DB),
      org.id,
      project.id,
      { email: 'invitee@example.com', role: 'member' },
    );

    expect(result.success).toBe(true);
    expect(result.email).toBe('invitee@example.com');

    const db = createDb(env.DB);
    const invitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.email, 'invitee@example.com'))
      .get();

    expect(invitation).toBeDefined();
    expect(invitation!.orgId).toBe(org.id);
    expect(invitation!.projectId).toBe(project.id);
    expect(invitation!.invitedBy).toBe(owner.id);
    expect(invitation!.acceptedAt).toBeNull();
    expect(invitation!.role).toBe('member');
    expect(invitation!.orgRole).toBe('member');
    expect(invitation!.grantOrgMembership).toBe(true);
  });

  it('lowercases email when creating invitation', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    await createProjectInvitation(mockSession(), createDb(env.DB), org.id, project.id, {
      email: 'UPPERCASE@EXAMPLE.COM',
      role: 'member',
    });

    const db = createDb(env.DB);
    const invitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, project.id))
      .get();

    expect(invitation!.email).toBe('uppercase@example.com');
  });

  it('resends existing pending invitation with updated role', async () => {
    const { project, org, owner } = await buildProject();
    const token = 'existing-token';

    const invitation = await buildProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: 'invitee@example.com',
      token,
      invitedBy: owner.id,
    });

    currentUser = { id: owner.id, email: owner.email };

    await createProjectInvitation(mockSession(), createDb(env.DB), org.id, project.id, {
      email: 'invitee@example.com',
      role: 'owner',
    });

    const db = createDb(env.DB);
    const invitations = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.email, 'invitee@example.com'))
      .all();

    expect(invitations).toHaveLength(1);
    expect(invitations[0].id).toBe(invitation.id);
    expect(invitations[0].token).toBe(token);
    expect(invitations[0].role).toBe('owner');
  });

  it('returns error when invitation already accepted', async () => {
    const { project, org, owner } = await buildProject();

    await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'invitee@example.com',
      invitedBy: owner.id,
      status: 'accepted',
    });

    currentUser = { id: owner.id, email: owner.email };

    try {
      await createProjectInvitation(mockSession(), createDb(env.DB), org.id, project.id, {
        email: 'invitee@example.com',
        role: 'member',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toMatch(/INVITATION_ALREADY_ACCEPTED/);
    }
  });
});

describe('listProjectInvitations', () => {
  it('lists only pending invitations', async () => {
    const { project, org, owner } = await buildProject();

    await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'pending@example.com',
      invitedBy: owner.id,
      status: 'pending',
    });

    await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'accepted@example.com',
      invitedBy: owner.id,
      status: 'accepted',
    });

    currentUser = { id: owner.id, email: owner.email };

    const result = await listProjectInvitations(
      mockSession(),
      createDb(env.DB),
      org.id,
      project.id,
    );
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('pending@example.com');
  });
});

describe('cancelProjectInvitation', () => {
  it('returns error for nonexistent invitation', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    try {
      await cancelProjectInvitation(
        mockSession(),
        createDb(env.DB),
        org.id,
        project.id,
        asProjectInvitationId('nonexistent'),
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toMatch(/FIELD_INVALID_FORMAT/);
    }
  });

  it('returns error when canceling accepted invitation', async () => {
    const { project, org, owner } = await buildProject();

    const invitation = await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'accepted@example.com',
      invitedBy: owner.id,
      status: 'accepted',
    });

    currentUser = { id: owner.id, email: owner.email };

    try {
      await cancelProjectInvitation(
        mockSession(),
        createDb(env.DB),
        org.id,
        project.id,
        invitation.id,
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toMatch(/INVITATION_ALREADY_ACCEPTED/);
    }
  });

  it('cancels pending invitation', async () => {
    const { project, org, owner } = await buildProject();

    const invitation = await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'pending@example.com',
      invitedBy: owner.id,
      status: 'pending',
    });

    currentUser = { id: owner.id, email: owner.email };

    const result = await cancelProjectInvitation(
      mockSession(),
      createDb(env.DB),
      org.id,
      project.id,
      invitation.id,
    );

    expect(result.success).toBe(true);
    expect(result.cancelled).toBe(invitation.id);

    const db = createDb(env.DB);
    const dbInvitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.id, invitation.id))
      .get();

    expect(dbInvitation).toBeUndefined();
  });
});
