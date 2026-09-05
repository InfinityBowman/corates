import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import {
  handleAcceptInvitation,
  handleGetInvitation,
  listPendingInvitationsForUser,
  declineInvitation as declineInvitationImpl,
} from './invitations.server';

export const acceptInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data, context: { session } }) => handleAcceptInvitation(session, data));

// Public: the invite landing page must render for signed-out users.
// The token itself is the access capability.
export const getInvitation = createServerFn({ method: 'GET' })
  .validator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => handleGetInvitation(data));

export const listMyPendingInvitations = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => listPendingInvitationsForUser(db, session));

export const declineInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ invitationId: z.string().min(1) }))
  .handler(async ({ data, context: { db, session } }) => declineInvitationImpl(db, session, data));
