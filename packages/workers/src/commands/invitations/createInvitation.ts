/**
 * Create or resend a project invitation
 *
 * Handles: existing invitation check, token generation, insert/update, email sending
 *
 * @throws DomainError INVITATION_ALREADY_ACCEPTED if invitation was already accepted
 */

import { createDb } from '@corates/db/client';
import { projectInvitations, projects, user } from '@corates/db/schema';
import { eq, and } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';
import { TIME_DURATIONS } from '@/config/constants';
import type { Env } from '@/types';

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

  if (existingInvitation && existingInvitation.acceptedAt) {
    throw createDomainError(PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED, {
      invitationId: existingInvitation.id,
    });
  }

  if (existingInvitation && !existingInvitation.acceptedAt) {
    // Resend: update role and extend expiration
    invitationId = existingInvitation.id;
    token = existingInvitation.token;
    const expiresAt = new Date(Date.now() + TIME_DURATIONS.INVITATION_EXPIRY_MS);

    await db
      .update(projectInvitations)
      .set({
        role,
        orgRole: 'member',
        grantOrgMembership: true,
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
    const { sendInvitationEmail } = await import('@/lib/send-invitation-email.js');
    const result = await sendInvitationEmail({
      env,
      email,
      token,
      projectName,
      inviterName,
      role,
    });
    emailQueued = result.emailQueued;
  } catch (err) {
    console.error('[Invitation] Magic link generation failed:', err);
  }

  return { invitationId, emailQueued };
}
