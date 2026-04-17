import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDb } from '@corates/db/client';
import { verification } from '@corates/db/schema';
import { eq, like } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  AUTH_ERRORS,
} from '@corates/shared';

export const handler = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }
  const currentUser = session.user;

  let body: { mergeToken?: string };
  try {
    body = (await request.json()) as { mergeToken?: string };
  } catch {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
    error.message = 'Invalid JSON input';
    return Response.json(error, { status: 400 });
  }

  const { mergeToken } = body;
  if (!mergeToken || typeof mergeToken !== 'string') {
    const error = createValidationError('mergeToken', VALIDATION_ERRORS.FIELD_REQUIRED.code, null);
    return Response.json(error, { status: 400 });
  }

  const db = createDb(env.DB);

  const mergeRequests = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, `merge:${currentUser.id}:%`));

  if (mergeRequests.length === 0) {
    return Response.json({ success: true as const }, { status: 200 });
  }

  const mergeRequest = mergeRequests[0];
  const mergeData = JSON.parse(mergeRequest.value) as { token: string };

  if (mergeData.token !== mergeToken) {
    const error = createValidationError(
      'mergeToken',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      mergeToken,
      'invalid_token',
    );
    return Response.json(error, { status: 400 });
  }

  await db.delete(verification).where(eq(verification.id, mergeRequest.id));

  return Response.json({ success: true as const }, { status: 200 });
};

export const Route = createFileRoute('/api/accounts/merge/cancel')({
  server: {
    handlers: {
      DELETE: handler,
    },
  },
});
