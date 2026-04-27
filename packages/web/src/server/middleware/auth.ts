import { createMiddleware } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { dbMiddleware } from './db';

export type { AuthUser, AuthSession } from '@corates/workers/auth';
export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export const authMiddleware = createMiddleware()
  .middleware([dbMiddleware])
  .server(async ({ next, request }) => {
    const session = await getSession(request, env);
    if (!session) {
      throw Response.json(createDomainError(AUTH_ERRORS.REQUIRED), { status: 401 });
    }
    return next({ context: { session, request } });
  });
