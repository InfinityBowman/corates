import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import { handleAcceptInvitation } from './invitations.server';

export const acceptInvitationAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data, context: { session } }) =>
    handleAcceptInvitation(session, data),
  );
