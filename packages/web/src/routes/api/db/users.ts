import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDb } from '@corates/db/client';
import { user } from '@corates/db/schema';
import { desc } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';

export const handleGet = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  const db = createDb(env.DB);

  try {
    const results = await db
      .select({
        id: user.id,
        username: user.username,
        email: user.email,
        givenName: user.givenName,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(20);

    return Response.json({ users: results });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching users:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_users',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const handlePost = async () => {
  const error = createValidationError(
    'endpoint',
    VALIDATION_ERRORS.INVALID_INPUT.code,
    null,
    'use_auth_register',
  );
  return Response.json(error, { status: 400 });
};

export const Route = createFileRoute('/api/db/users')({
  server: {
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
});
