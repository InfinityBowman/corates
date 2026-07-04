/**
 * Look up a project invitation by token for the public invite landing page.
 *
 * The token is the capability: anyone holding it may see the invitation
 * summary (project name, inviter, invited email, role) — the same details
 * already present in the invitation email.
 *
 * @throws DomainError FIELD_INVALID_FORMAT if no invitation matches the token
 */

import { createDb } from '@corates/db/client';
import { projectInvitations, projects, user } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, VALIDATION_ERRORS } from '@corates/shared';
import type { Env } from '../../types';

interface GetInvitationByTokenParams {
  token: string;
}

export interface InvitationSummary {
  status: 'pending' | 'expired' | 'accepted';
  projectName: string;
  inviterName: string;
  email: string;
  role: string | null;
}

export async function getInvitationByToken(
  env: Env,
  { token }: GetInvitationByTokenParams,
): Promise<InvitationSummary> {
  const db = createDb(env.DB);

  const invitation = await db
    .select({
      projectId: projectInvitations.projectId,
      email: projectInvitations.email,
      role: projectInvitations.role,
      expiresAt: projectInvitations.expiresAt,
      acceptedAt: projectInvitations.acceptedAt,
      invitedBy: projectInvitations.invitedBy,
    })
    .from(projectInvitations)
    .where(eq(projectInvitations.token, token))
    .get();

  if (!invitation) {
    throw createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
      field: 'token',
      value: token,
    });
  }

  const project = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, invitation.projectId))
    .get();

  const inviter = await db
    .select({ name: user.name, givenName: user.givenName, email: user.email })
    .from(user)
    .where(eq(user.id, invitation.invitedBy))
    .get();

  let status: InvitationSummary['status'] = 'pending';
  if (invitation.acceptedAt) {
    status = 'accepted';
  } else if (Date.now() > invitation.expiresAt.getTime()) {
    status = 'expired';
  }

  return {
    status,
    projectName: project?.name || 'Unknown Project',
    inviterName: inviter?.givenName || inviter?.name || inviter?.email || 'Someone',
    email: invitation.email,
    role: invitation.role,
  };
}
