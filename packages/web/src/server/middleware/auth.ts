import { createMiddleware } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { runWithContext } from '@corates/workers/logger';
import { throwDomainError, AUTH_ERRORS } from '@corates/shared';
import { dbMiddleware } from './db';

export type { AuthUser, AuthSession } from '@corates/workers/auth';
export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export const authMiddleware = createMiddleware()
  .middleware([dbMiddleware])
  .server(async ({ next, request }) => {
    const session = await getSession(request, env);
    if (!session) {
      throwDomainError(AUTH_ERRORS.REQUIRED);
    }
    // Narrow the request scope opened in src/server.ts now that the caller is
    // known, so downstream command logs carry userId alongside requestId.
    return runWithContext({ userId: session.user.id }, () =>
      next({ context: { session, request } }),
    );
  });
