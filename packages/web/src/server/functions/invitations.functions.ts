import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import { handleAcceptInvitation, handleGetInvitation } from './invitations.server';

export const acceptInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data, context: { session } }) => handleAcceptInvitation(session, data));

// Public: the invite landing page must render for signed-out users.
// The token itself is the access capability.
export const getInvitation = createServerFn({ method: 'GET' })
  .validator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => handleGetInvitation(data));
