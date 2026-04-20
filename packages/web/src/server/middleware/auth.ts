import { createMiddleware } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { identifyUser } from '@corates/workers/logger';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { logMiddleware } from './log';
import { dbMiddleware } from './db';

export type { AuthUser, AuthSession } from '@corates/workers/auth';
export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export const authMiddleware = createMiddleware()
  .middleware([logMiddleware, dbMiddleware])
  .server(async ({ next, request, context }) => {
    const session = await getSession(request, env);
    if (!session) {
      throw Response.json(createDomainError(AUTH_ERRORS.REQUIRED), { status: 401 });
    }
    identifyUser(context.log, session, { maskEmail: true });
    return next({ context: { session, request } });
  });
