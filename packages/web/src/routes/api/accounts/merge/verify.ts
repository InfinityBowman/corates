import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDb } from '@corates/db/client';
import { account, verification } from '@corates/db/schema';
import { eq, like } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  USER_ERRORS,
  AUTH_ERRORS,
} from '@corates/shared';
import { checkRateLimit, MERGE_VERIFY_RATE_LIMIT } from '@/server/rateLimit';

export const handler = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }
  const currentUser = session.user;

  let body: { mergeToken?: string; code?: string };
  try {
    body = (await request.json()) as { mergeToken?: string; code?: string };
  } catch {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
    error.message = 'Invalid JSON input';
    return Response.json(error, { status: 400 });
  }

  const { mergeToken, code } = body;
  if (!mergeToken || typeof mergeToken !== 'string') {
    const error = createValidationError('mergeToken', VALIDATION_ERRORS.FIELD_REQUIRED.code, null);
    return Response.json(error, { status: 400 });
  }
  if (!code || typeof code !== 'string') {
    const error = createValidationError('code', VALIDATION_ERRORS.FIELD_REQUIRED.code, null);
    return Response.json(error, { status: 400 });
  }
  const trimmedCode = code.trim();

  const rate = checkRateLimit(request, env, MERGE_VERIFY_RATE_LIMIT, mergeToken);
  if (rate.blocked) return rate.blocked;

  const db = createDb(env.DB);

  const mergeRequests = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, `merge:${currentUser.id}:%`));

  if (mergeRequests.length === 0) {
    const error = createDomainError(USER_ERRORS.NOT_FOUND, {
      context: 'merge_request',
      userId: currentUser.id,
    });
    return Response.json(error, { status: 404 });
  }

  const mergeRequest = mergeRequests[0];
  const mergeData = JSON.parse(mergeRequest.value) as {
    token: string;
    code: string;
    targetId: string;
    verified: boolean;
  };

  if (mergeData.token !== mergeToken) {
    const error = createValidationError(
      'mergeToken',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      mergeToken,
      'invalid_token',
    );
    return Response.json(error, { status: 400 });
  }

  if (mergeRequest.expiresAt < new Date()) {
    await db.delete(verification).where(eq(verification.id, mergeRequest.id));
    const error = createValidationError(
      'code',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'expired',
    );
    return Response.json(error, { status: 400 });
  }

  if (mergeData.code !== trimmedCode) {
    const error = createValidationError(
      'code',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'invalid_code',
    );
    return Response.json(error, { status: 400 });
  }

  const verifiedData = {
    ...mergeData,
    verified: true,
    verifiedAt: Date.now(),
  };

  await db
    .update(verification)
    .set({
      value: JSON.stringify(verifiedData),
      updatedAt: new Date(),
    })
    .where(eq(verification.id, mergeRequest.id));

  const [currentAccounts, targetAccounts] = await Promise.all([
    db
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, currentUser.id)),
    db
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, mergeData.targetId)),
  ]);

  return Response.json(
    {
      success: true as const,
      message: 'Code verified. You can now complete the merge.',
      preview: {
        currentProviders: currentAccounts.map(a => a.providerId),
        targetProviders: targetAccounts.map(a => a.providerId),
      },
    },
    { status: 200 },
  );
};

export const Route = createFileRoute('/api/accounts/merge/verify')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
