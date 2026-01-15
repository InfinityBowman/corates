/**
 * Account Merge Routes
 *
 * Handles merging two user accounts when a user owns both
 * (e.g., signed up with Google, then magic link with different email)
 *
 * Simple flow using email verification:
 * 1. User A tries to link OAuth that belongs to User B
 * 2. Frontend shows "Merge accounts?" option
 * 3. User enters the email of the other account
 * 4. Backend sends a 6-digit code to that email
 * 5. User enters the code to prove ownership
 * 6. Backend performs the merge
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@/db/client.js';
import { user, account, projects, projectMembers, mediaFiles, verification } from '@/db/schema.js';
import { eq, sql, like, and } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { rateLimit } from '@/middleware/rateLimit.js';
import { createEmailService } from '@/auth/email.js';
import { getAccountMergeEmailHtml, getAccountMergeEmailText } from '@/auth/emailTemplates.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  USER_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import { validationHook } from '@/lib/honoValidationHook.js';

const accountMergeRoutes = new OpenAPIHono({
  defaultHook: validationHook,
});

// All routes require authentication
accountMergeRoutes.use('*', requireAuth);

// Rate limiters
const mergeInitiateRateLimiter = rateLimit({
  limit: 3,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'merge-initiate',
  keyGenerator: c => c.get('mergeInitiateKey') || 'unknown',
});

const mergeVerifyRateLimiter = rateLimit({
  limit: 5,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'merge-verify',
  keyGenerator: c => c.get('mergeTokenKey') || 'unknown',
});

// Helper functions
function generateCode() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
}

function normalizeOrcidId(orcidId) {
  if (!orcidId || typeof orcidId !== 'string') return '';
  let normalized = orcidId.replace(/@orcid\.org$/i, '');
  normalized = normalized.replace(/-/g, '');
  return normalized.toLowerCase();
}

function formatOrcidId(orcidId) {
  if (!orcidId || typeof orcidId !== 'string') return '';
  const cleaned = orcidId.replace(/-/g, '');
  if (cleaned.length === 16) {
    return cleaned.replace(/(\d{4})(\d{4})(\d{4})(\d{3}[\dXx])/, '$1-$2-$3-$4');
  }
  return cleaned;
}

// Request schemas
const InitiateRequestSchema = z
  .object({
    targetEmail: z.email().optional().openapi({ example: 'other@example.com' }),
    targetOrcidId: z.string().optional().openapi({ example: '0000-0001-2345-6789' }),
  })
  .openapi('MergeInitiateRequest');

const VerifyRequestSchema = z
  .object({
    mergeToken: z.string().min(1).openapi({ example: 'abc123-token' }),
    code: z.string().min(1).openapi({ example: '123456' }),
  })
  .openapi('MergeVerifyRequest');

const CompleteRequestSchema = z
  .object({
    mergeToken: z.string().min(1).openapi({ example: 'abc123-token' }),
  })
  .openapi('MergeCompleteRequest');

const CancelRequestSchema = z
  .object({
    mergeToken: z.string().min(1).openapi({ example: 'abc123-token' }),
  })
  .openapi('MergeCancelRequest');

// Response schemas
const InitiateSuccessSchema = z
  .object({
    success: z.literal(true),
    mergeToken: z.string(),
    targetEmail: z.string(),
    targetOrcidId: z.string().nullable(),
    preview: z.object({
      currentProviders: z.array(z.string()),
    }),
  })
  .openapi('MergeInitiateSuccess');

const VerifySuccessSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
    preview: z.object({
      currentProviders: z.array(z.string()),
      targetProviders: z.array(z.string()),
    }),
  })
  .openapi('MergeVerifySuccess');

const CompleteSuccessSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
    mergedProviders: z.array(z.string()),
  })
  .openapi('MergeCompleteSuccess');

const CancelSuccessSchema = z
  .object({
    success: z.literal(true),
  })
  .openapi('MergeCancelSuccess');

const MergeErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('MergeError');

// Route definitions
const initiateRoute = createRoute({
  method: 'post',
  path: '/initiate',
  tags: ['Account Merge'],
  summary: 'Initiate account merge',
  description: 'Start a merge request. Sends a verification code to the target email.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: InitiateRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: InitiateSuccessSchema } },
      description: 'Merge initiated, verification code sent',
    },
    400: {
      content: { 'application/json': { schema: MergeErrorSchema } },
      description: 'Validation error',
    },
    404: {
      content: { 'application/json': { schema: MergeErrorSchema } },
      description: 'Target user not found',
    },
    429: {
      content: { 'application/json': { schema: MergeErrorSchema } },
      description: 'Rate limit exceeded',
    },
  },
});

const verifyRoute = createRoute({
  method: 'post',
  path: '/verify',
  tags: ['Account Merge'],
  summary: 'Verify merge code',
  description: 'Verify the code sent to the target email',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: VerifyRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: VerifySuccessSchema } },
      description: 'Code verified successfully',
    },
    400: {
      content: { 'application/json': { schema: MergeErrorSchema } },
      description: 'Invalid or expired code',
    },
    404: {
      content: { 'application/json': { schema: MergeErrorSchema } },
      description: 'Merge request not found',
    },
    429: {
      content: { 'application/json': { schema: MergeErrorSchema } },
      description: 'Rate limit exceeded',
    },
  },
});

const completeRoute = createRoute({
  method: 'post',
  path: '/complete',
  tags: ['Account Merge'],
  summary: 'Complete account merge',
  description: 'Complete the merge after verification',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CompleteRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CompleteSuccessSchema } },
      description: 'Accounts merged successfully',
    },
    400: {
      content: { 'application/json': { schema: MergeErrorSchema } },
      description: 'Validation error or not verified',
    },
    404: {
      content: { 'application/json': { schema: MergeErrorSchema } },
      description: 'Merge request not found',
    },
    500: {
      content: { 'application/json': { schema: MergeErrorSchema } },
      description: 'Database error',
    },
  },
});

const cancelRoute = createRoute({
  method: 'delete',
  path: '/cancel',
  tags: ['Account Merge'],
  summary: 'Cancel merge request',
  description: 'Cancel a pending merge request',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CancelRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CancelSuccessSchema } },
      description: 'Merge request cancelled',
    },
    400: {
      content: { 'application/json': { schema: MergeErrorSchema } },
      description: 'Invalid token',
    },
  },
});

// Route handlers
accountMergeRoutes.openapi(initiateRoute, async c => {
  const { user: currentUser } = getAuth(c);
  const { targetEmail, targetOrcidId } = c.req.valid('json');

  const hasEmail = targetEmail && typeof targetEmail === 'string' && targetEmail.trim();
  const hasOrcidId = targetOrcidId && typeof targetOrcidId === 'string' && targetOrcidId.trim();

  if (!hasEmail && !hasOrcidId) {
    const error = createValidationError(
      'targetEmail/targetOrcidId',
      VALIDATION_ERRORS.FIELD_REQUIRED.code,
      null,
      'required',
    );
    return c.json(error, error.statusCode);
  }

  if (hasEmail && hasOrcidId) {
    const error = createValidationError(
      'targetEmail/targetOrcidId',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'cannot_provide_both',
    );
    return c.json(error, error.statusCode);
  }

  const db = createDb(c.env.DB);
  let targetUser = null;
  let targetOrcidAccount = null;
  let lookupMethod = 'email';

  if (hasEmail) {
    const normalizedEmail = targetEmail.trim().toLowerCase();

    if (normalizedEmail === currentUser.email.toLowerCase()) {
      const error = createValidationError(
        'targetEmail',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        normalizedEmail,
        'cannot_merge_self',
      );
      return c.json(error, error.statusCode);
    }

    c.set('mergeInitiateKey', `${currentUser.id}:${normalizedEmail}`);
    const rateLimitResult = await mergeInitiateRateLimiter(c, async () => {});
    if (rateLimitResult) {
      return rateLimitResult;
    }

    targetUser = await db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(sql`lower(${user.email}) = ${normalizedEmail}`)
      .limit(1)
      .then(rows => rows[0]);
  } else {
    const normalizedOrcidId = normalizeOrcidId(targetOrcidId);

    if (!normalizedOrcidId || normalizedOrcidId.length !== 16) {
      const error = createValidationError(
        'targetOrcidId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        targetOrcidId,
        'invalid_orcid_format',
      );
      return c.json(error, error.statusCode);
    }

    c.set('mergeInitiateKey', `${currentUser.id}:${normalizedOrcidId}`);
    const rateLimitResult = await mergeInitiateRateLimiter(c, async () => {});
    if (rateLimitResult) {
      return rateLimitResult;
    }

    targetOrcidAccount = await db
      .select({
        accountId: account.accountId,
        userId: account.userId,
      })
      .from(account)
      .where(
        and(
          eq(account.providerId, 'orcid'),
          sql`REPLACE(REPLACE(${account.accountId}, '-', ''), '@orcid.org', '') = ${normalizedOrcidId}`,
        ),
      )
      .limit(1)
      .then(rows => rows[0]);

    if (targetOrcidAccount) {
      targetUser = await db
        .select({ id: user.id, email: user.email, name: user.name })
        .from(user)
        .where(eq(user.id, targetOrcidAccount.userId))
        .limit(1)
        .then(rows => rows[0]);
    }

    lookupMethod = 'orcid';
  }

  if (!targetUser) {
    const error = createDomainError(USER_ERRORS.NOT_FOUND, {
      email: hasEmail ? targetEmail : undefined,
      orcidId: hasOrcidId ? targetOrcidId : undefined,
    });
    return c.json(error, error.statusCode);
  }

  if (targetUser.id === currentUser.id) {
    const error = createValidationError(
      hasEmail ? 'targetEmail' : 'targetOrcidId',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      hasEmail ? targetEmail : targetOrcidId,
      'cannot_merge_self',
    );
    return c.json(error, error.statusCode);
  }

  const [currentAccounts, _targetAccounts] = await Promise.all([
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

  const emailService = createEmailService(c.env);
  const emailResult = await emailService.sendEmail({
    to: targetUser.email,
    subject: 'CoRATES Account Merge Verification Code',
    html: getAccountMergeEmailHtml({ code: verificationCode }),
    text: getAccountMergeEmailText({ code: verificationCode }),
  });

  if (!emailResult.success) {
    console.error('[AccountMerge] Failed to send verification email:', emailResult.error);

    await db
      .delete(verification)
      .where(eq(verification.identifier, `merge:${currentUser.id}:${targetUser.id}`));

    const error = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED, {
      operation: 'send_merge_verification',
      originalError: emailResult.error?.message,
    });
    return c.json(error, error.statusCode);
  }

  if (c.env.ENVIRONMENT !== 'production') {
    console.log('[AccountMerge] DEV MODE - Verification code:', verificationCode);
  }

  let formattedOrcidId = null;
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

  return c.json({
    success: true,
    mergeToken,
    targetEmail: targetUser.email,
    targetOrcidId: formattedOrcidId,
    preview: {
      currentProviders: currentAccounts.map(a => a.providerId),
    },
  });
});

accountMergeRoutes.openapi(verifyRoute, async c => {
  const { user: currentUser } = getAuth(c);
  const { mergeToken, code } = c.req.valid('json');

  const trimmedCode = code.trim();

  c.set('mergeTokenKey', mergeToken);
  const rateLimitResult = await mergeVerifyRateLimiter(c, async () => {});
  if (rateLimitResult) {
    return rateLimitResult;
  }

  const db = createDb(c.env.DB);

  const mergeRequests = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, `merge:${currentUser.id}:%`));

  if (mergeRequests.length === 0) {
    const error = createDomainError(USER_ERRORS.NOT_FOUND, {
      context: 'merge_request',
      userId: currentUser.id,
    });
    return c.json(error, error.statusCode);
  }

  const mergeRequest = mergeRequests[0];
  const mergeData = JSON.parse(mergeRequest.value);

  if (mergeData.token !== mergeToken) {
    const error = createValidationError(
      'mergeToken',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      mergeToken,
      'invalid_token',
    );
    return c.json(error, error.statusCode);
  }

  if (mergeRequest.expiresAt < new Date()) {
    await db.delete(verification).where(eq(verification.id, mergeRequest.id));
    const error = createValidationError(
      'code',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'expired',
    );
    return c.json(error, error.statusCode);
  }

  if (mergeData.code !== trimmedCode) {
    const error = createValidationError(
      'code',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'invalid_code',
    );
    return c.json(error, error.statusCode);
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

  return c.json({
    success: true,
    message: 'Code verified. You can now complete the merge.',
    preview: {
      currentProviders: currentAccounts.map(a => a.providerId),
      targetProviders: targetAccounts.map(a => a.providerId),
    },
  });
});

accountMergeRoutes.openapi(completeRoute, async c => {
  const { user: currentUser } = getAuth(c);
  const { mergeToken } = c.req.valid('json');

  const db = createDb(c.env.DB);

  const mergeRequests = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, `merge:${currentUser.id}:%`));

  if (mergeRequests.length === 0) {
    const error = createDomainError(USER_ERRORS.NOT_FOUND, {
      context: 'merge_request',
      userId: currentUser.id,
    });
    return c.json(error, error.statusCode);
  }

  const mergeRequest = mergeRequests[0];
  const mergeData = JSON.parse(mergeRequest.value);

  if (mergeData.token !== mergeToken) {
    const error = createValidationError(
      'mergeToken',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      mergeToken,
      'invalid_token',
    );
    return c.json(error, error.statusCode);
  }

  if (!mergeData.verified) {
    const error = createValidationError(
      'code',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'code_not_verified',
    );
    return c.json(error, error.statusCode);
  }

  if (mergeRequest.expiresAt < new Date()) {
    await db.delete(verification).where(eq(verification.id, mergeRequest.id));
    const error = createValidationError(
      'mergeRequest',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'expired',
    );
    return c.json(error, error.statusCode);
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

    await db.batch(batchOps);

    return c.json({
      success: true,
      message: 'Accounts merged successfully',
      mergedProviders,
    });
  } catch (err) {
    console.error('[AccountMerge] Error during merge:', err);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'merge_accounts',
      originalError: err.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

accountMergeRoutes.openapi(cancelRoute, async c => {
  const { user: currentUser } = getAuth(c);
  const { mergeToken } = c.req.valid('json');

  const db = createDb(c.env.DB);

  const mergeRequests = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, `merge:${currentUser.id}:%`));

  if (mergeRequests.length === 0) {
    return c.json({ success: true });
  }

  const mergeRequest = mergeRequests[0];
  const mergeData = JSON.parse(mergeRequest.value);

  if (mergeData.token !== mergeToken) {
    const error = createValidationError(
      'mergeToken',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      mergeToken,
      'invalid_token',
    );
    return c.json(error, error.statusCode);
  }

  await db.delete(verification).where(eq(verification.id, mergeRequest.id));

  return c.json({ success: true });
});

export { accountMergeRoutes };
