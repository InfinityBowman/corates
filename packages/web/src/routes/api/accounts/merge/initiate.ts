import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDb } from '@corates/db/client';
import { user, account, verification } from '@corates/db/schema';
import { eq, sql, like, and } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  USER_ERRORS,
  SYSTEM_ERRORS,
  AUTH_ERRORS,
} from '@corates/shared';
import {
  getAccountMergeEmailHtml,
  getAccountMergeEmailText,
} from '@corates/workers/email-templates';
import {
  checkRateLimit,
  MERGE_INITIATE_RATE_LIMIT,
} from '@/server/rateLimit';

function generateCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
}

function normalizeOrcidId(orcidId: string | undefined | null): string {
  if (!orcidId || typeof orcidId !== 'string') return '';
  let normalized = orcidId.replace(/@orcid\.org$/i, '');
  normalized = normalized.replace(/-/g, '');
  return normalized.toLowerCase();
}

function formatOrcidId(orcidId: string | undefined | null): string {
  if (!orcidId || typeof orcidId !== 'string') return '';
  const cleaned = orcidId.replace(/-/g, '');
  if (cleaned.length === 16) {
    return cleaned.replace(/(\d{4})(\d{4})(\d{4})(\d{3}[\dXx])/, '$1-$2-$3-$4');
  }
  return cleaned;
}

export const handler = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }
  const currentUser = session.user;

  let body: { targetEmail?: string; targetOrcidId?: string };
  try {
    body = (await request.json()) as { targetEmail?: string; targetOrcidId?: string };
  } catch {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
    error.message = 'Invalid JSON input';
    return Response.json(error, { status: 400 });
  }

  const { targetEmail, targetOrcidId } = body;
  const hasEmail = !!(targetEmail && typeof targetEmail === 'string' && targetEmail.trim());
  const hasOrcidId = !!(targetOrcidId && typeof targetOrcidId === 'string' && targetOrcidId.trim());

  if (!hasEmail && !hasOrcidId) {
    const error = createValidationError(
      'targetEmail/targetOrcidId',
      VALIDATION_ERRORS.FIELD_REQUIRED.code,
      null,
      'required',
    );
    return Response.json(error, { status: 400 });
  }

  if (hasEmail && hasOrcidId) {
    const error = createValidationError(
      'targetEmail/targetOrcidId',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'cannot_provide_both',
    );
    return Response.json(error, { status: 400 });
  }

  const db = createDb(env.DB);
  let targetUser: { id: string; email: string; name: string | null } | null = null;
  let targetOrcidAccount: { accountId: string; userId: string } | null = null;
  let lookupMethod = 'email';
  let rateIdentifier: string;

  if (hasEmail) {
    const normalizedEmail = targetEmail!.trim().toLowerCase();

    if (normalizedEmail === currentUser.email.toLowerCase()) {
      const error = createValidationError(
        'targetEmail',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        normalizedEmail,
        'cannot_merge_self',
      );
      return Response.json(error, { status: 400 });
    }

    rateIdentifier = `${currentUser.id}:${normalizedEmail}`;
    const rate = checkRateLimit(request, env, MERGE_INITIATE_RATE_LIMIT, rateIdentifier);
    if (rate.blocked) return rate.blocked;

    targetUser =
      (await db
        .select({ id: user.id, email: user.email, name: user.name })
        .from(user)
        .where(sql`lower(${user.email}) = ${normalizedEmail}`)
        .limit(1)
        .then(rows => rows[0])) || null;
  } else {
    const normalizedOrcidId = normalizeOrcidId(targetOrcidId);

    if (!normalizedOrcidId || normalizedOrcidId.length !== 16) {
      const error = createValidationError(
        'targetOrcidId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        targetOrcidId ?? null,
        'invalid_orcid_format',
      );
      return Response.json(error, { status: 400 });
    }

    rateIdentifier = `${currentUser.id}:${normalizedOrcidId}`;
    const rate = checkRateLimit(request, env, MERGE_INITIATE_RATE_LIMIT, rateIdentifier);
    if (rate.blocked) return rate.blocked;

    targetOrcidAccount =
      (await db
        .select({ accountId: account.accountId, userId: account.userId })
        .from(account)
        .where(
          and(
            eq(account.providerId, 'orcid'),
            sql`REPLACE(REPLACE(${account.accountId}, '-', ''), '@orcid.org', '') = ${normalizedOrcidId}`,
          ),
        )
        .limit(1)
        .then(rows => rows[0])) || null;

    if (targetOrcidAccount) {
      targetUser =
        (await db
          .select({ id: user.id, email: user.email, name: user.name })
          .from(user)
          .where(eq(user.id, targetOrcidAccount.userId))
          .limit(1)
          .then(rows => rows[0])) || null;
    }

    lookupMethod = 'orcid';
  }

  if (!targetUser) {
    const error = createDomainError(USER_ERRORS.NOT_FOUND, {
      email: hasEmail ? targetEmail : undefined,
      orcidId: hasOrcidId ? targetOrcidId : undefined,
    });
    return Response.json(error, { status: 404 });
  }

  if (targetUser.id === currentUser.id) {
    const error = createValidationError(
      hasEmail ? 'targetEmail' : 'targetOrcidId',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      hasEmail ? targetEmail! : targetOrcidId!,
      'cannot_merge_self',
    );
    return Response.json(error, { status: 400 });
  }

  const [currentAccounts] = await Promise.all([
    db
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, currentUser.id)),
    db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, targetUser.id)),
  ]);

  await db.delete(verification).where(like(verification.identifier, `merge:${currentUser.id}:%`));

  const verificationCode = generateCode();
  const mergeToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: `merge:${currentUser.id}:${targetUser.id}`,
    value: JSON.stringify({
      token: mergeToken,
      code: verificationCode,
      initiatorId: currentUser.id,
      initiatorEmail: currentUser.email,
      targetId: targetUser.id,
      targetEmail: targetUser.email,
      verified: false,
    }),
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  try {
    await env.EMAIL_QUEUE.send({
      to: targetUser.email,
      subject: 'CoRATES Account Merge Verification Code',
      html: getAccountMergeEmailHtml({ code: verificationCode }),
      text: getAccountMergeEmailText({ code: verificationCode }),
    });
  } catch (err) {
    console.error('[AccountMerge] Failed to queue verification email:', err);

    await db
      .delete(verification)
      .where(eq(verification.identifier, `merge:${currentUser.id}:${targetUser.id}`));

    const error = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED, {
      operation: 'send_merge_verification',
      originalError: String(err instanceof Error ? err.message : 'Unknown email error'),
    });
    return Response.json(error, { status: 400 });
  }

  if (env.ENVIRONMENT !== 'production') {
    console.log('[AccountMerge] DEV MODE - Verification code:', verificationCode);
  }

  let formattedOrcidId: string | null = null;
  if (lookupMethod === 'orcid' && targetOrcidAccount) {
    formattedOrcidId = formatOrcidId(targetOrcidAccount.accountId);
  } else {
    const orcidAccount = await db
      .select({ accountId: account.accountId })
      .from(account)
      .where(and(eq(account.userId, targetUser.id), eq(account.providerId, 'orcid')))
      .limit(1)
      .then(rows => rows[0]);

    if (orcidAccount) {
      formattedOrcidId = formatOrcidId(orcidAccount.accountId);
    }
  }

  return Response.json(
    {
      success: true as const,
      mergeToken,
      targetEmail: targetUser.email,
      targetOrcidId: formattedOrcidId,
      preview: {
        currentProviders: currentAccounts.map(a => a.providerId),
      },
    },
    { status: 200 },
  );
};

export const Route = createFileRoute('/api/accounts/merge/initiate')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
