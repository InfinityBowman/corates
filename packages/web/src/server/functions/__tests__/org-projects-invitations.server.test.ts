import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { createDb } from '@corates/db/client';
import { projectInvitations } from '@corates/db/schema';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import {
  buildProject,
  buildProjectInvitation,
  resetCounter,
  asProjectInvitationId,
} from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import { DomainErrorException } from '@corates/shared';
import {
  listProjectInvitations,
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
  vi.clearAllMocks();
  resetCounter();
  currentUser = { id: 'user-1', email: 'user1@example.com' };
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
      expect(err).toBeInstanceOf(DomainErrorException);
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(400);
      const body = res.toDomainError() as { code: string };
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
      expect(err).toBeInstanceOf(DomainErrorException);
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(400);
      const body = res.toDomainError() as { code: string };
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
