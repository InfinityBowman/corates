/**
 * Create or resend a project invitation
 *
 * Handles: existing invitation check, send caps, token generation,
 * insert/update, email sending
 *
 * @throws DomainError PROJECT_INVITATION_LIMIT_REACHED when the project has too many live invitations
 * @throws DomainError PROJECT_INVITATION_RATE_LIMITED when the inviter has created too many in an hour
 */

import { captureError, info } from '../../lib/logger';
import { createDb, type Database } from '@corates/db/client';
import { projectInvitations, projects, user } from '@corates/db/schema';
import { eq, and, count, gt, isNull, sql } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';
import { isSyntheticEmail, normalizeEmail, type InvitationDelivery } from '@corates/shared/email';
import { INVITATION_LIMITS, TIME_DURATIONS } from '../../config/constants';
import type { Env } from '../../types';
import { createNotification } from '../notifications';

interface CreateInvitationActor {
  id: string;
}

interface CreateInvitationParams {
  orgId: string;
  projectId: string;
  email: string;
  role: string;
}

interface CreateInvitationResult {
  invitationId: string;
  delivery: InvitationDelivery;
}

function findExisting(db: Database, projectId: string, email: string) {
  return db
    .select({
      id: projectInvitations.id,
      token: projectInvitations.token,
      acceptedAt: projectInvitations.acceptedAt,
      emailSentAt: projectInvitations.emailSentAt,
    })
    .from(projectInvitations)
    .where(and(eq(projectInvitations.projectId, projectId), eq(projectInvitations.email, email)))
    .get();
}

async function assertWithinSendCaps(db: Database, projectId: string, inviterId: string) {
  const now = new Date();

  const [pending] = await db
    .select({ count: count() })
    .from(projectInvitations)
    .where(
      and(
        eq(projectInvitations.projectId, projectId),
        isNull(projectInvitations.acceptedAt),
        gt(projectInvitations.expiresAt, now),
      ),
    );
  if ((pending?.count ?? 0) >= INVITATION_LIMITS.MAX_PENDING_PER_PROJECT) {
    throw createDomainError(PROJECT_ERRORS.INVITATION_LIMIT_REACHED, {
      projectId,
      limit: INVITATION_LIMITS.MAX_PENDING_PER_PROJECT,
    });
  }

  const [recent] = await db
    .select({ count: count() })
    .from(projectInvitations)
    .where(
      and(
        eq(projectInvitations.invitedBy, inviterId),
        gt(projectInvitations.createdAt, new Date(now.getTime() - TIME_DURATIONS.ONE_HOUR_MS)),
      ),
    );
  if ((recent?.count ?? 0) >= INVITATION_LIMITS.MAX_CREATED_PER_INVITER_PER_HOUR) {
    throw createDomainError(PROJECT_ERRORS.INVITATION_RATE_LIMITED, {
      limit: INVITATION_LIMITS.MAX_CREATED_PER_INVITER_PER_HOUR,
    });
  }
}

export async function createInvitation(
  env: Env,
  actor: CreateInvitationActor,
  { orgId, projectId, email, role }: CreateInvitationParams,
): Promise<CreateInvitationResult> {
  const db = createDb(env.DB);
  const normalizedEmail = normalizeEmail(email);
  const expiresAt = new Date(Date.now() + TIME_DURATIONS.INVITATION_EXPIRY_MS);

  let existing = await findExisting(db, projectId, normalizedEmail);
  let invitationId: string = crypto.randomUUID();
  let token: string = crypto.randomUUID();

  if (!existing) {
    await assertWithinSendCaps(db, projectId, actor.id);

    const inserted = await db
      .insert(projectInvitations)
      .values({
        id: invitationId,
        orgId,
        projectId,
        email: normalizedEmail,
        role,
        orgRole: 'member',
        grantOrgMembership: true,
        token,
        invitedBy: actor.id,
        expiresAt,
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: projectInvitations.id });

    // A concurrent request for the same address won the insert; treat ours as a resend
    if (inserted.length === 0) {
      existing = await findExisting(db, projectId, normalizedEmail);
    }
  }

  if (existing) {
    // Resend: update role and extend expiration. A previously accepted
    // invitation is reset with a fresh token so someone who was removed from
    // the project can be invited again (accepting is the only way back in);
    // the old emailed link stays dead because the token changes.
    invitationId = existing.id;
    token = existing.acceptedAt ? crypto.randomUUID() : existing.token;

    await db
      .update(projectInvitations)
      .set({
        role,
        orgRole: 'member',
        grantOrgMembership: true,
        token,
        acceptedAt: null,
        expiresAt,
      })
      .where(eq(projectInvitations.id, existing.id));
  }

  // Fetch context for email
  const project = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  const inviter = await db
    .select({ name: user.name, givenName: user.givenName, email: user.email })
    .from(user)
    .where(eq(user.id, actor.id))
    .get();

  const projectName = project?.name || 'Unknown Project';
  const inviterName = inviter?.givenName || inviter?.name || inviter?.email || 'Someone';

  const recentlySent =
    !!existing?.emailSentAt &&
    Date.now() - existing.emailSentAt.getTime() < INVITATION_LIMITS.RESEND_COOLDOWN_MS;

  // Synthetic ORCID addresses bounce and poison sender reputation; the
  // in-app notification below still reaches those accounts.
  let delivery: InvitationDelivery = 'not_sent';
  if (recentlySent) {
    delivery = 'recently_sent';
  } else if (!isSyntheticEmail(normalizedEmail)) {
    try {
      const { sendInvitationEmail } = await import('../../lib/send-invitation-email.js');
      const result = await sendInvitationEmail({
        env,
        email: normalizedEmail,
        token,
        projectName,
        inviterName,
        role,
        invitationId,
      });
      if (result.emailQueued) {
        delivery = 'queued';
        await db
          .update(projectInvitations)
          .set({ emailSentAt: new Date(), emailStatus: 'queued' })
          .where(eq(projectInvitations.id, invitationId));
      }
    } catch (err) {
      captureError(err, {
        tags: { component: 'invitation', action: 'send-email' },
        extra: { projectId },
      });
    }
  }

  // An invitee who already has an account also gets the invitation in-app.
  // Emitted on resend too, since the token may have rotated.
  const invitee = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, normalizedEmail))
    .get();

  if (invitee && invitee.id !== actor.id) {
    await createNotification(env, {
      userId: invitee.id,
      type: 'invitation.received',
      data: { invitationId, token, projectId, projectName, inviterName, role },
    });
  }

  info('invitation.created', { orgId, projectId, invitationId, role, delivery });

  return { invitationId, delivery };
}
