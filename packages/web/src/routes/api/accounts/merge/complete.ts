import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import {
  user,
  account,
  projects,
  projectMembers,
  mediaFiles,
  verification,
} from '@corates/db/schema';
import { eq, like } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  USER_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import { authMiddleware, type Session } from '@/server/middleware/auth';

export const handler = async ({
  request,
  context: { db, session },
}: {
  request: Request;
  context: { db: Database; session: Session };
}) => {
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

  if (!mergeData.verified) {
    const error = createValidationError(
      'code',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'code_not_verified',
    );
    return Response.json(error, { status: 400 });
  }

  if (mergeRequest.expiresAt < new Date()) {
    await db.delete(verification).where(eq(verification.id, mergeRequest.id));
    const error = createValidationError(
      'mergeRequest',
      VALIDATION_ERRORS.INVALID_INPUT.code,
      null,
      'expired',
    );
    return Response.json(error, { status: 400 });
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

    return Response.json(
      {
        success: true as const,
        message: 'Accounts merged successfully',
        mergedProviders,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[AccountMerge] Error during merge:', err);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'merge_accounts',
      originalError: err instanceof Error ? err.message : String(err),
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/accounts/merge/complete')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: handler,
    },
  },
});
