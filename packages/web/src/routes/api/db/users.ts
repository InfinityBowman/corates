import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { user } from '@corates/db/schema';
import { desc } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { authMiddleware } from '@/server/middleware/auth';

export const handleGet = async ({
  context: { db },
}: {
  request: Request;
  context: { db: Database };
}) => {
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
    middleware: [authMiddleware],
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
});
