import type { Database } from '@corates/db/client';
import { user } from '@corates/db/schema';
import { desc } from 'drizzle-orm';
import { createValidationError, VALIDATION_ERRORS } from '@corates/shared';

export async function listUsers(db: Database) {
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

  return { users: results };
}

export function usersPostDeprecated(): never {
  const error = createValidationError(
    'endpoint',
    VALIDATION_ERRORS.INVALID_INPUT.code,
    null,
    'use_auth_register',
  );
  throw Response.json(error, { status: 400 });
}
