import { createMiddleware } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { runWithContext, captureError } from '@corates/workers/logger';
import { throwDomainError, AUTH_ERRORS } from '@corates/shared';
import { dbMiddleware } from './db';

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

// Session-or-null for public routes that render differently when signed in.
// Never refuses a request, so handlers must treat the session as presentation
// input only -- authorization stays with authMiddleware.
export const optionalAuthMiddleware = createMiddleware().server(async ({ next, request }) => {
  let session: Session | null = null;
  try {
    session = await getSession(request, env);
  } catch (err) {
    // A public page must still render when the session read fails
    captureError(err, { tags: { component: 'auth', action: 'optional-session' } });
  }
  const run = () => next({ context: { session } });
  return session ? runWithContext({ userId: session.user.id }, run) : run();
});
