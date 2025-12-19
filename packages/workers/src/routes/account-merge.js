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
import { eq, sql, like } from 'drizzle-orm';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { createEmailService } from '../auth/email.js';
import { getAccountMergeEmailHtml, getAccountMergeEmailText } from '../auth/emailTemplates.js';

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
 * POST /api/accounts/merge/initiate
 *
 * Start a merge request. Sends a verification code to the target email.
 *
 * Body: { targetEmail: string }
 */
accountMergeRoutes.post('/initiate', async c => {
  const { user: currentUser } = getAuth(c);
  const { targetEmail } = await c.req.json();

  if (!targetEmail || typeof targetEmail !== 'string') {
    return c.json({ error: 'Target email is required' }, 400);
  }

  const normalizedEmail = targetEmail.trim().toLowerCase();

  if (normalizedEmail === currentUser.email.toLowerCase()) {
    return c.json({ error: 'Cannot merge with your own account' }, 400);
  }

  // Apply rate limiting keyed by user ID + target email
  c.set('mergeInitiateKey', `${currentUser.id}:${normalizedEmail}`);
  const rateLimitResult = await mergeInitiateRateLimiter(c, async () => {});
  if (rateLimitResult) {
    return rateLimitResult;
  }

  const db = createDb(c.env.DB);

  // Find the target user
  const targetUser = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(sql`lower(${user.email}) = ${normalizedEmail}`)
    .limit(1)
    .then(rows => rows[0]);

  if (!targetUser) {
    return c.json({ error: 'No account found with that email' }, 404);
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

    return c.json({ error: 'Failed to send verification email. Please try again later.' }, 502);
  }

  // In dev, log the code for testing
  if (c.env.ENVIRONMENT !== 'production') {
    console.log('[AccountMerge] DEV MODE - Verification code:', verificationCode);
  }

  return c.json({
    success: true,
    mergeToken,
    targetEmail: targetUser.email,
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
    return c.json({ error: 'Merge token and code are required' }, 400);
  }

  if (typeof mergeToken !== 'string' || typeof code !== 'string') {
    return c.json({ error: 'Merge token and code must be strings' }, 400);
  }

  const trimmedCode = code.trim();
  if (!trimmedCode) {
    return c.json({ error: 'Code cannot be empty' }, 400);
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
    return c.json({ error: 'Merge request not found' }, 404);
  }

  const mergeRequest = mergeRequests[0];
  const mergeData = JSON.parse(mergeRequest.value);

  // Verify token matches
  if (mergeData.token !== mergeToken) {
    return c.json({ error: 'Invalid merge token' }, 400);
  }

  // Check expiry
  if (mergeRequest.expiresAt < new Date()) {
    await db.delete(verification).where(eq(verification.id, mergeRequest.id));
    return c.json({ error: 'Verification code has expired. Please start again.' }, 400);
  }

  // Verify code
  if (mergeData.code !== trimmedCode) {
    return c.json({ error: 'Invalid verification code' }, 400);
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
    return c.json({ error: 'Merge token is required' }, 400);
  }

  if (typeof mergeToken !== 'string' || mergeToken.trim().length === 0) {
    return c.json({ error: 'Merge token must be a non-empty string' }, 400);
  }

  const db = createDb(c.env.DB);

  // Find the merge request
  const mergeRequests = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, `merge:${currentUser.id}:%`));

  if (mergeRequests.length === 0) {
    return c.json({ error: 'Merge request not found' }, 404);
  }

  const mergeRequest = mergeRequests[0];
  const mergeData = JSON.parse(mergeRequest.value);

  // Verify token matches
  if (mergeData.token !== mergeToken) {
    return c.json({ error: 'Invalid merge token' }, 400);
  }

  // Ensure it's verified
  if (!mergeData.verified) {
    return c.json({ error: 'Please verify the code first' }, 400);
  }

  // Check expiry
  if (mergeRequest.expiresAt < new Date()) {
    await db.delete(verification).where(eq(verification.id, mergeRequest.id));
    return c.json({ error: 'Merge request has expired. Please start again.' }, 400);
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
    return c.json({ error: 'Failed to merge accounts. Please try again.' }, 500);
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
