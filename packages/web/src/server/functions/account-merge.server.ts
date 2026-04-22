import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import {
  user,
  account,
  projects,
  projectMembers,
  mediaFiles,
  verification,
} from '@corates/db/schema';
import { eq, sql, like, and } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  USER_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import {
  getAccountMergeEmailHtml,
  getAccountMergeEmailText,
} from '@corates/workers/email-templates';
import { checkRateLimit, MERGE_INITIATE_RATE_LIMIT, MERGE_VERIFY_RATE_LIMIT } from '@/server/rateLimit';
import type { Session } from '@/server/middleware/auth';

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

export interface InitiateResult {
  success: true;
  mergeToken: string;
  targetEmail: string;
  targetOrcidId: string | null;
  preview: { currentProviders: string[] };
}

export async function initiateMergeRequest(
  db: Database,
  session: Session,
  request: Request,
  data: { targetEmail?: string; targetOrcidId?: string },
): Promise<InitiateResult> {
  const currentUser = session.user;
  const { targetEmail, targetOrcidId } = data;
  const hasEmail = !!(targetEmail && targetEmail.trim());
  const hasOrcidId = !!(targetOrcidId && targetOrcidId.trim());

  if (!hasEmail && !hasOrcidId) {
    throw Response.json(
      createValidationError(
        'targetEmail/targetOrcidId',
        VALIDATION_ERRORS.FIELD_REQUIRED.code,
        null,
        'required',
      ),
      { status: 400 },
    );
  }

  if (hasEmail && hasOrcidId) {
    throw Response.json(
      createValidationError(
        'targetEmail/targetOrcidId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        null,
        'cannot_provide_both',
      ),
      { status: 400 },
    );
  }

  let targetUser: { id: string; email: string; name: string | null } | null = null;
  let targetOrcidAccount: { accountId: string; userId: string } | null = null;
  let lookupMethod = 'email';
  let rateIdentifier: string;

  if (hasEmail) {
    const normalizedEmail = targetEmail!.trim().toLowerCase();

    if (normalizedEmail === currentUser.email.toLowerCase()) {
      throw Response.json(
        createValidationError(
          'targetEmail',
          VALIDATION_ERRORS.INVALID_INPUT.code,
          normalizedEmail,
          'cannot_merge_self',
        ),
        { status: 400 },
      );
    }

    rateIdentifier = `${currentUser.id}:${normalizedEmail}`;
    const rate = checkRateLimit(request, env, MERGE_INITIATE_RATE_LIMIT, rateIdentifier);
    if (rate.blocked) throw rate.blocked;

    targetUser =
      (await db
        .select({ id: user.id, email: user.email, name: user.name })
        .from(user)
        .where(sql`lower(${user.email}) = ${normalizedEmail}`)
        .limit(1)
        .then(rows => rows[0])) || null;
  } else {
    const normalizedOrcid = normalizeOrcidId(targetOrcidId);

    if (!normalizedOrcid || normalizedOrcid.length !== 16) {
      throw Response.json(
        createValidationError(
          'targetOrcidId',
          VALIDATION_ERRORS.INVALID_INPUT.code,
          targetOrcidId ?? null,
          'invalid_orcid_format',
        ),
        { status: 400 },
      );
    }

    rateIdentifier = `${currentUser.id}:${normalizedOrcid}`;
    const rate = checkRateLimit(request, env, MERGE_INITIATE_RATE_LIMIT, rateIdentifier);
    if (rate.blocked) throw rate.blocked;

    targetOrcidAccount =
      (await db
        .select({ accountId: account.accountId, userId: account.userId })
        .from(account)
        .where(
          and(
            eq(account.providerId, 'orcid'),
            sql`REPLACE(REPLACE(${account.accountId}, '-', ''), '@orcid.org', '') = ${normalizedOrcid}`,
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
    throw Response.json(
      createDomainError(USER_ERRORS.NOT_FOUND, {
        email: hasEmail ? targetEmail : undefined,
        orcidId: hasOrcidId ? targetOrcidId : undefined,
      }),
      { status: 404 },
    );
  }

  if (targetUser.id === currentUser.id) {
    throw Response.json(
      createValidationError(
        hasEmail ? 'targetEmail' : 'targetOrcidId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        hasEmail ? targetEmail! : targetOrcidId!,
        'cannot_merge_self',
      ),
      { status: 400 },
    );
  }

  const [currentAccounts] = await Promise.all([
    db
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, currentUser.id)),
    db
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, targetUser.id)),
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

    throw Response.json(
      createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED, {
        operation: 'send_merge_verification',
        originalError: String(err instanceof Error ? err.message : 'Unknown email error'),
      }),
      { status: 400 },
    );
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

  return {
    success: true as const,
    mergeToken,
    targetEmail: targetUser.email,
    targetOrcidId: formattedOrcidId,
    preview: {
      currentProviders: currentAccounts.map(a => a.providerId),
    },
  };
}

export interface VerifyResult {
  success: true;
  message: string;
  preview: { currentProviders: string[]; targetProviders: string[] };
}

export async function verifyMerge(
  db: Database,
  session: Session,
  request: Request,
  data: { mergeToken: string; code: string },
): Promise<VerifyResult> {
  const currentUser = session.user;
  const { mergeToken, code } = data;
  const trimmedCode = code.trim();

  const rate = checkRateLimit(request, env, MERGE_VERIFY_RATE_LIMIT, mergeToken);
  if (rate.blocked) throw rate.blocked;

  const mergeRequests = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, `merge:${currentUser.id}:%`));

  if (mergeRequests.length === 0) {
    throw Response.json(
      createDomainError(USER_ERRORS.NOT_FOUND, {
        context: 'merge_request',
        userId: currentUser.id,
      }),
      { status: 404 },
    );
  }

  const mergeRequest = mergeRequests[0];
  const mergeData = JSON.parse(mergeRequest.value) as {
    token: string;
    code: string;
    targetId: string;
    verified: boolean;
  };

  if (mergeData.token !== mergeToken) {
    throw Response.json(
      createValidationError(
        'mergeToken',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        mergeToken,
        'invalid_token',
      ),
      { status: 400 },
    );
  }

  if (mergeRequest.expiresAt < new Date()) {
    await db.delete(verification).where(eq(verification.id, mergeRequest.id));
    throw Response.json(
      createValidationError('code', VALIDATION_ERRORS.INVALID_INPUT.code, null, 'expired'),
      { status: 400 },
    );
  }

  if (mergeData.code !== trimmedCode) {
    throw Response.json(
      createValidationError('code', VALIDATION_ERRORS.INVALID_INPUT.code, null, 'invalid_code'),
      { status: 400 },
    );
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

  return {
    success: true as const,
    message: 'Code verified. You can now complete the merge.',
    preview: {
      currentProviders: currentAccounts.map(a => a.providerId),
      targetProviders: targetAccounts.map(a => a.providerId),
    },
  };
}

export interface CompleteResult {
  success: true;
  message: string;
  mergedProviders: string[];
}

export async function completeMergeRequest(
  db: Database,
  session: Session,
  mergeToken: string,
): Promise<CompleteResult> {
  const currentUser = session.user;

  const mergeRequests = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, `merge:${currentUser.id}:%`));

  if (mergeRequests.length === 0) {
    throw Response.json(
      createDomainError(USER_ERRORS.NOT_FOUND, {
        context: 'merge_request',
        userId: currentUser.id,
      }),
      { status: 404 },
    );
  }

  const mergeRequest = mergeRequests[0];
  const mergeData = JSON.parse(mergeRequest.value) as {
    token: string;
    targetId: string;
    verified: boolean;
  };

  if (mergeData.token !== mergeToken) {
    throw Response.json(
      createValidationError(
        'mergeToken',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        mergeToken,
        'invalid_token',
      ),
      { status: 400 },
    );
  }

  if (!mergeData.verified) {
    throw Response.json(
      createValidationError(
        'code',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        null,
        'code_not_verified',
      ),
      { status: 400 },
    );
  }

  if (mergeRequest.expiresAt < new Date()) {
    await db.delete(verification).where(eq(verification.id, mergeRequest.id));
    throw Response.json(
      createValidationError(
        'mergeRequest',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        null,
        'expired',
      ),
      { status: 400 },
    );
  }

  const primaryUserId = currentUser.id;
  const secondaryUserId = mergeData.targetId;

  try {
    const [primaryAccounts, secondaryAccounts, primaryMemberships, secondaryMemberships] =
      await Promise.all([
        db
          .select({ providerId: account.providerId })
          .from(account)
          .where(eq(account.userId, primaryUserId)),
        db.select().from(account).where(eq(account.userId, secondaryUserId)),
        db
          .select({ projectId: projectMembers.projectId })
          .from(projectMembers)
          .where(eq(projectMembers.userId, primaryUserId)),
        db.select().from(projectMembers).where(eq(projectMembers.userId, secondaryUserId)),
      ]);

    const primaryProviders = new Set(primaryAccounts.map(a => a.providerId));
    const accountsToMove = secondaryAccounts.filter(a => !primaryProviders.has(a.providerId));
    const duplicateAccounts = secondaryAccounts.filter(a => primaryProviders.has(a.providerId));
    const mergedProviders = accountsToMove.map(a => a.providerId);

    const primaryMemberProjects = new Set(primaryMemberships.map(m => m.projectId));
    const membershipsToDelete = secondaryMemberships.filter(m =>
      primaryMemberProjects.has(m.projectId),
    );
    const membershipsToMove = secondaryMemberships.filter(
      m => !primaryMemberProjects.has(m.projectId),
    );

    const batchOps = [];
    const now = new Date();

    for (const acc of accountsToMove) {
      batchOps.push(
        db
          .update(account)
          .set({ userId: primaryUserId, updatedAt: now })
          .where(eq(account.id, acc.id)),
      );
    }

    for (const acc of duplicateAccounts) {
      batchOps.push(db.delete(account).where(eq(account.id, acc.id)));
    }

    batchOps.push(
      db
        .update(projects)
        .set({ createdBy: primaryUserId, updatedAt: now })
        .where(eq(projects.createdBy, secondaryUserId)),
    );

    for (const mem of membershipsToDelete) {
      batchOps.push(db.delete(projectMembers).where(eq(projectMembers.id, mem.id)));
    }
    for (const mem of membershipsToMove) {
      batchOps.push(
        db
          .update(projectMembers)
          .set({ userId: primaryUserId })
          .where(eq(projectMembers.id, mem.id)),
      );
    }

    batchOps.push(
      db
        .update(mediaFiles)
        .set({ uploadedBy: primaryUserId })
        .where(eq(mediaFiles.uploadedBy, secondaryUserId)),
    );

    batchOps.push(db.delete(user).where(eq(user.id, secondaryUserId)));
    batchOps.push(db.delete(verification).where(eq(verification.id, mergeRequest.id)));

    await db.batch(batchOps as [(typeof batchOps)[0], ...typeof batchOps]);

    return {
      success: true as const,
      message: 'Accounts merged successfully',
      mergedProviders,
    };
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error('[AccountMerge] Error during merge:', err);
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'merge_accounts',
        originalError: err instanceof Error ? err.message : String(err),
      }),
      { status: 500 },
    );
  }
}

export async function cancelMergeRequest(db: Database, session: Session, mergeToken: string) {
  const currentUser = session.user;

  const mergeRequests = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, `merge:${currentUser.id}:%`));

  if (mergeRequests.length === 0) {
    return { success: true as const };
  }

  const mergeRequest = mergeRequests[0];
  const mergeData = JSON.parse(mergeRequest.value) as { token: string };

  if (mergeData.token !== mergeToken) {
    throw Response.json(
      createValidationError(
        'mergeToken',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        mergeToken,
        'invalid_token',
      ),
      { status: 400 },
    );
  }

  await db.delete(verification).where(eq(verification.id, mergeRequest.id));

  return { success: true as const };
}
