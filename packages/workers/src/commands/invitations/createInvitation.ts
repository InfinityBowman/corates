/**
 * Create or resend a project invitation
 *
 * Handles: existing invitation check, token generation, insert/update, email sending
 */

import { captureError, info } from '../../lib/logger';
import { createDb } from '@corates/db/client';
import { projectInvitations, projects, user } from '@corates/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { isSyntheticEmail } from '@corates/shared/email';
import { TIME_DURATIONS } from '../../config/constants';
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
  emailQueued: boolean;
}

export async function createInvitation(
  env: Env,
  actor: CreateInvitationActor,
  { orgId, projectId, email, role }: CreateInvitationParams,
): Promise<CreateInvitationResult> {
  const db = createDb(env.DB);
  const normalizedEmail = email.toLowerCase();

  const existingInvitation = await db
    .select({
      id: projectInvitations.id,
      token: projectInvitations.token,
      acceptedAt: projectInvitations.acceptedAt,
    })
    .from(projectInvitations)
    .where(
      and(
        eq(projectInvitations.projectId, projectId),
        eq(projectInvitations.email, normalizedEmail),
      ),
    )
    .get();

  let token: string;
  let invitationId: string;

  if (existingInvitation) {
    // Resend: update role and extend expiration. A previously accepted
    // invitation is reset with a fresh token so someone who was removed from
    // the project can be invited again (accepting is the only way back in);
    // the old emailed link stays dead because the token changes.
    invitationId = existingInvitation.id;
    token = existingInvitation.acceptedAt ? crypto.randomUUID() : existingInvitation.token;
    const expiresAt = new Date(Date.now() + TIME_DURATIONS.INVITATION_EXPIRY_MS);

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
      .where(eq(projectInvitations.id, existingInvitation.id));
  } else {
    invitationId = crypto.randomUUID();
    token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TIME_DURATIONS.INVITATION_EXPIRY_MS);

    await db.insert(projectInvitations).values({
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
    });
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

  let emailQueued = false;
  try {
    // Synthetic ORCID addresses bounce and poison sender reputation
    if (!isSyntheticEmail(email)) {
      const { sendInvitationEmail } = await import('../../lib/send-invitation-email.js');
      const result = await sendInvitationEmail({
        env,
        email,
        token,
        projectName,
        inviterName,
        role,
      });
      emailQueued = result.emailQueued;
    }
  } catch (err) {
    captureError(err, {
      tags: { component: 'invitation', action: 'send-email' },
      extra: { projectId },
    });
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

  info('invitation.created', { orgId, projectId, invitationId, role, emailQueued });

  return { invitationId, emailQueued };
}
