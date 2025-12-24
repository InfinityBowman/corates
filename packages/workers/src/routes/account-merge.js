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

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import {
  user,
  account,
  projects,
  projectMembers,
  subscriptions,
  mediaFiles,
  verification,
} from '../db/schema.js';
import { eq, sql, like, and } from 'drizzle-orm';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { createEmailService } from '../auth/email.js';
import { getAccountMergeEmailHtml, getAccountMergeEmailText } from '../auth/emailTemplates.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  USER_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';

const accountMergeRoutes = new Hono();

// All routes require authentication
accountMergeRoutes.use('*', requireAuth);

// Tier priority for subscription merging
const TIER_PRIORITY = { enterprise: 4, team: 3, pro: 2, free: 1 };

// Rate limiter for merge initiate (3 attempts per 15 minutes per user+email)
const mergeInitiateRateLimiter = rateLimit({
  limit: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'merge-initiate',
  keyGenerator: c => c.get('mergeInitiateKey') || 'unknown',
});

/**
 * Generate a 6-digit verification code
 */
// function generateCode() {
//   return Math.floor(100000 + Math.random() * 900000).toString();
// }

function generateCode() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
}

/**
 * Normalize ORCID ID for lookup
 * Removes hyphens and @orcid.org suffix, converts to lowercase
 * @param {string} orcidId - ORCID ID (e.g., "0000-0001-2345-6789" or "0000-0001-2345-6789@orcid.org")
 * @returns {string} Normalized ORCID ID (e.g., "0000000123456789")
 */
function normalizeOrcidId(orcidId) {
  if (!orcidId || typeof orcidId !== 'string') return '';
  // Remove @orcid.org suffix if present
  let normalized = orcidId.replace(/@orcid\.org$/i, '');
  // Remove hyphens
  normalized = normalized.replace(/-/g, '');
  // Convert to lowercase
  return normalized.toLowerCase();
}

/**
 * Format ORCID ID for display (add hyphens)
 * @param {string} orcidId - Normalized ORCID ID (e.g., "0000000123456789")
 * @returns {string} Formatted ORCID ID (e.g., "0000-0001-2345-6789")
 */
function formatOrcidId(orcidId) {
  if (!orcidId || typeof orcidId !== 'string') return '';
  // Remove any existing hyphens
  const cleaned = orcidId.replace(/-/g, '');
  // Format as XXXX-XXXX-XXXX-XXXX (last char can be X for checksum)
  if (cleaned.length === 16) {
    return cleaned.replace(/(\d{4})(\d{4})(\d{4})(\d{3}[\dXx])/, '$1-$2-$3-$4');
  }
  return cleaned;
}

/**
 * POST /api/accounts/merge/initiate
 *
 * Start a merge request. Sends a verification code to the target email.
 *
 * Body: { targetEmail?: string, targetOrcidId?: string }
 * Either targetEmail or targetOrcidId must be provided, but not both.
 */
accountMergeRoutes.post('/initiate', async c => {
  const { user: currentUser } = getAuth(c);
  const { targetEmail, targetOrcidId } = await c.req.json();

  // Validate that exactly one identifier is provided
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

    // Apply rate limiting keyed by user ID + target email
    c.set('mergeInitiateKey', `${currentUser.id}:${normalizedEmail}`);
    const rateLimitResult = await mergeInitiateRateLimiter(c, async () => {});
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Find the target user by email
    targetUser = await db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(sql`lower(${user.email}) = ${normalizedEmail}`)
      .limit(1)
      .then(rows => rows[0]);
  } else {
    // Lookup by ORCID ID
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

    // Apply rate limiting keyed by user ID + ORCID ID
    c.set('mergeInitiateKey', `${currentUser.id}:${normalizedOrcidId}`);
    const rateLimitResult = await mergeInitiateRateLimiter(c, async () => {});
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Find the ORCID account
    // Normalize both stored accountId and input for comparison (remove hyphens)
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
      // Find the user associated with this ORCID account
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

  // Prevent merging with self
  if (targetUser.id === currentUser.id) {
    const error = createValidationError(
      hasEmail ? 'targetEmail' : 'targetOrcidId',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      hasEmail ? targetEmail : targetOrcidId,
      'cannot_merge_self',
    );
    return c.json(error, error.statusCode);
  }

  // Get linked accounts for both users to show what will be merged
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

  // Delete any existing merge requests for this user
  await db.delete(verification).where(like(verification.identifier, `merge:${currentUser.id}:%`));

  // Generate verification code and token
  const verificationCode = generateCode();
  const mergeToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Store merge request data
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

  // Send verification code email
  const emailService = createEmailService(c.env);
  const emailResult = await emailService.sendEmail({
    to: targetUser.email,
    subject: 'CoRATES Account Merge Verification Code',
    html: getAccountMergeEmailHtml({ code: verificationCode }),
    text: getAccountMergeEmailText({ code: verificationCode }),
  });

  if (!emailResult.success) {
    console.error('[AccountMerge] Failed to send verification email:', emailResult.error);

    // Roll back: delete the merge token that was just created
    await db
      .delete(verification)
      .where(eq(verification.identifier, `merge:${currentUser.id}:${targetUser.id}`));

    const error = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED, {
      operation: 'send_merge_verification',
      originalError: emailResult.error?.message,
    });
    return c.json(error, error.statusCode);
  }

  // In dev, log the code for testing
  if (c.env.ENVIRONMENT !== 'production') {
    console.log('[AccountMerge] DEV MODE - Verification code:', verificationCode);
  }

  // Get ORCID ID if the target account has one (for response)
  let formattedOrcidId = null;
  if (lookupMethod === 'orcid' && targetOrcidAccount) {
    formattedOrcidId = formatOrcidId(targetOrcidAccount.accountId);
  } else {
    // Check if target user has an ORCID account
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
      // targetProviders deferred until after code verification for security
    },
  });
});

// Rate limiter for merge verification attempts (5 attempts per 15 minutes per token)
const mergeVerifyRateLimiter = rateLimit({
  limit: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'merge-verify',
  keyGenerator: c => c.get('mergeTokenKey') || 'unknown',
});

/**
 * POST /api/accounts/merge/verify
 *
 * Verify the code sent to the target email
 *
 * Body: { mergeToken: string, code: string }
 */
accountMergeRoutes.post('/verify', async c => {
  const { user: currentUser } = getAuth(c);
  const { mergeToken, code } = await c.req.json();

  if (!mergeToken || !code) {
    const error = createValidationError(
      'mergeToken/code',
      VALIDATION_ERRORS.FIELD_REQUIRED.code,
      null,
      'required',
    );
    return c.json(error, error.statusCode);
  }

  if (typeof mergeToken !== 'string' || typeof code !== 'string') {
    const error = createValidationError(
      'mergeToken/code',
      VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code,
      { mergeToken: typeof mergeToken, code: typeof code },
      'invalid_type',
    );
    return c.json(error, error.statusCode);
  }

  const trimmedCode = code.trim();
  if (!trimmedCode) {
    const error = createValidationError(
      'code',
      VALIDATION_ERRORS.FIELD_REQUIRED.code,
      null,
      'empty',
    );
    return c.json(error, error.statusCode);
  }

  // Apply rate limiting keyed by mergeToken
  c.set('mergeTokenKey', mergeToken);
  const rateLimitResult = await mergeVerifyRateLimiter(c, async () => {});
  if (rateLimitResult) {
    return rateLimitResult;
  }

  const db = createDb(c.env.DB);

  // Find the merge request
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

  // Verify token matches
  if (mergeData.token !== mergeToken) {
    const error = createValidationError(
      'mergeToken',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      mergeToken,
      'invalid_token',
    );
    return c.json(error, error.statusCode);
  }

  // Check expiry
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

  // Verify code
  if (mergeData.code !== trimmedCode) {
    const error = createValidationError(
      'code',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'invalid_code',
    );
    return c.json(error, error.statusCode);
  }

  // Mark as verified
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

  // Now that email ownership is verified, fetch and return provider info
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

/**
 * POST /api/accounts/merge/complete
 *
 * Complete the merge after verification
 *
 * Body: { mergeToken: string }
 */
accountMergeRoutes.post('/complete', async c => {
  const { user: currentUser } = getAuth(c);
  const { mergeToken } = await c.req.json();

  if (typeof mergeToken !== 'string' || !mergeToken.trim()) {
    const error = createValidationError(
      'mergeToken',
      VALIDATION_ERRORS.FIELD_REQUIRED.code,
      null,
      'required',
    );
    return c.json(error, error.statusCode);
  }

  const db = createDb(c.env.DB);

  // Find the merge request
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

  // Verify token matches
  if (mergeData.token !== mergeToken) {
    const error = createValidationError(
      'mergeToken',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      mergeToken,
      'invalid_token',
    );
    return c.json(error, error.statusCode);
  }

  // Ensure it's verified
  if (!mergeData.verified) {
    const error = createValidationError(
      'code',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'code_not_verified',
    );
    return c.json(error, error.statusCode);
  }

  // Check expiry
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
    // Gather all data needed to build the batch
    const [
      primaryAccounts,
      secondaryAccounts,
      primaryMemberships,
      secondaryMemberships,
      primarySub,
      secondarySub,
    ] = await Promise.all([
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
      db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, primaryUserId))
        .then(rows => rows[0]),
      db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, secondaryUserId))
        .then(rows => rows[0]),
    ]);

    // Prepare account operations
    const primaryProviders = new Set(primaryAccounts.map(a => a.providerId));
    const accountsToMove = secondaryAccounts.filter(a => !primaryProviders.has(a.providerId));
    const duplicateAccounts = secondaryAccounts.filter(a => primaryProviders.has(a.providerId));
    const mergedProviders = accountsToMove.map(a => a.providerId);

    // Prepare membership operations
    const primaryMemberProjects = new Set(primaryMemberships.map(m => m.projectId));
    const membershipsToDelete = secondaryMemberships.filter(m =>
      primaryMemberProjects.has(m.projectId),
    );
    const membershipsToMove = secondaryMemberships.filter(
      m => !primaryMemberProjects.has(m.projectId),
    );

    // Prepare subscription operations
    let deleteOldPrimarySub = false;
    let moveSecondarySub = false;
    let deleteSecondarySub = false;

    if (secondarySub) {
      const primaryPriority = TIER_PRIORITY[primarySub?.tier] || 0;
      const secondaryPriority = TIER_PRIORITY[secondarySub.tier] || 0;

      if (secondaryPriority > primaryPriority) {
        if (primarySub) deleteOldPrimarySub = true;
        moveSecondarySub = true;
      } else {
        deleteSecondarySub = true;
      }
    }

    // Build batch of all operations - executed as a transaction (all-or-nothing)
    const batchOps = [];
    const now = new Date();

    // 1. Move non-duplicate OAuth accounts to primary user
    for (const acc of accountsToMove) {
      batchOps.push(
        db
          .update(account)
          .set({ userId: primaryUserId, updatedAt: now })
          .where(eq(account.id, acc.id)),
      );
    }

    // 2. Delete duplicate provider accounts from secondary
    for (const acc of duplicateAccounts) {
      batchOps.push(db.delete(account).where(eq(account.id, acc.id)));
    }

    // 3. Update project ownership
    batchOps.push(
      db
        .update(projects)
        .set({ createdBy: primaryUserId, updatedAt: now })
        .where(eq(projects.createdBy, secondaryUserId)),
    );

    // 4. Handle project memberships
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

    // 5. Handle subscriptions
    if (deleteOldPrimarySub) {
      batchOps.push(db.delete(subscriptions).where(eq(subscriptions.id, primarySub.id)));
    }
    if (moveSecondarySub) {
      batchOps.push(
        db
          .update(subscriptions)
          .set({ userId: primaryUserId, updatedAt: now })
          .where(eq(subscriptions.id, secondarySub.id)),
      );
    }
    if (deleteSecondarySub) {
      batchOps.push(db.delete(subscriptions).where(eq(subscriptions.userId, secondaryUserId)));
    }

    // 6. Update media files ownership
    batchOps.push(
      db
        .update(mediaFiles)
        .set({ uploadedBy: primaryUserId })
        .where(eq(mediaFiles.uploadedBy, secondaryUserId)),
    );

    // 7. Delete secondary user (sessions, etc. will cascade)
    batchOps.push(db.delete(user).where(eq(user.id, secondaryUserId)));

    // 8. Clean up merge request
    batchOps.push(db.delete(verification).where(eq(verification.id, mergeRequest.id)));

    // Execute all operations as a single atomic batch transaction
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

/**
 * DELETE /api/accounts/merge/cancel
 *
 * Cancel a pending merge request
 *
 * Body: { mergeToken: string }
 */
accountMergeRoutes.delete('/cancel', async c => {
  const { user: currentUser } = getAuth(c);
  const { mergeToken } = await c.req.json();

  const db = createDb(c.env.DB);

  // Find and delete the merge request
  const mergeRequests = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, `merge:${currentUser.id}:%`));

  if (mergeRequests.length > 0) {
    const mergeRequest = mergeRequests[0];
    const mergeData = JSON.parse(mergeRequest.value);

    if (!mergeToken || mergeData.token === mergeToken) {
      await db.delete(verification).where(eq(verification.id, mergeRequest.id));
    }
  }

  return c.json({ success: true });
});

export { accountMergeRoutes };
