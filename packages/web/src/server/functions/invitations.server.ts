import { captureError } from '@corates/workers/logger';
import { env } from 'cloudflare:workers';
import {
  acceptInvitation,
  getInvitationByToken,
  type InvitationSummary,
} from '@corates/workers/commands/invitations';
import {
  createDomainError,
  isDomainError,
  DomainErrorException,
  PROJECT_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
  type DomainError,
} from '@corates/shared';
import type { Database } from '@corates/db/client';
import { projectInvitations, projects, user } from '@corates/db/schema';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { Session } from '@/server/middleware/auth';

export interface AcceptResult {
  success: true;
  orgId: string | null;
  orgSlug?: string;
  projectId: string;
  projectName: string;
  role?: string;
  alreadyMember?: boolean;
}

export async function handleAcceptInvitation(
  session: Session,
  data: { token: string },
): Promise<AcceptResult> {
  try {
    const result = await acceptInvitation(env, { id: session.user.id }, { token: data.token });
    return {
      success: true,
      orgId: result.orgId,
      orgSlug: result.orgSlug ?? undefined,
      projectId: result.projectId,
      projectName: result.projectName,
      role: result.role ?? undefined,
      alreadyMember: result.alreadyMember || undefined,
    };
  } catch (err) {
    if (isDomainError(err)) {
      const de = err as DomainError;
      throw new DomainErrorException(de);
    }
    captureError(err, { tags: { component: 'invitations', action: 'accept' } });
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'accept_invitation',
      originalError: (err as Error).message,
    });
    throw new DomainErrorException(dbError);
  }
}

export async function handleGetInvitation(data: { token: string }): Promise<InvitationSummary> {
  try {
    return await getInvitationByToken(env, { token: data.token });
  } catch (err) {
    if (isDomainError(err)) {
      throw new DomainErrorException(err as DomainError);
    }
    captureError(err, { tags: { component: 'invitations', action: 'get' } });
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'get_invitation',
      originalError: (err as Error).message,
    });
    throw new DomainErrorException(dbError);
  }
}

export interface PendingInvitation {
  id: string;
  token: string;
  projectName: string;
  inviterName: string;
  role: string | null;
}

/**
 * Invitations the signed-in user can act on right now. Matched on the
 * normalized email, so this also covers accounts created after the invitation
 * was sent, which never received an `invitation.received` notification.
 */
export async function listPendingInvitationsForUser(
  db: Database,
  session: Session,
): Promise<PendingInvitation[]> {
  const rows = await db
    .select({
      id: projectInvitations.id,
      token: projectInvitations.token,
      role: projectInvitations.role,
      projectName: projects.name,
      inviterName: user.name,
      inviterGivenName: user.givenName,
      inviterEmail: user.email,
    })
    .from(projectInvitations)
    .innerJoin(projects, eq(projects.id, projectInvitations.projectId))
    .leftJoin(user, eq(user.id, projectInvitations.invitedBy))
    .where(
      and(
        eq(projectInvitations.email, session.user.email.toLowerCase()),
        isNull(projectInvitations.acceptedAt),
        gt(projectInvitations.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(projectInvitations.createdAt));

  return rows.map(row => ({
    id: row.id,
    token: row.token,
    role: row.role,
    projectName: row.projectName,
    inviterName: row.inviterGivenName || row.inviterName || row.inviterEmail || 'Someone',
  }));
}

/**
 * Invitee-side decline. Deletes the row, exactly like the inviter's cancel, so
 * the ghost card disappears on every device. The inviter is not notified.
 */
export async function declineInvitation(
  db: Database,
  session: Session,
  { invitationId }: { invitationId: string },
): Promise<{ success: true }> {
  const invitation = await db
    .select({ email: projectInvitations.email, acceptedAt: projectInvitations.acceptedAt })
    .from(projectInvitations)
    .where(eq(projectInvitations.id, invitationId))
    .get();

  if (!invitation || invitation.email !== session.user.email.toLowerCase()) {
    throw new DomainErrorException(
      createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'invitationId',
        value: invitationId,
      }),
    );
  }
  if (invitation.acceptedAt) {
    throw new DomainErrorException(
      createDomainError(PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED, { invitationId }),
    );
  }

  await db.delete(projectInvitations).where(eq(projectInvitations.id, invitationId));
  return { success: true };
}
