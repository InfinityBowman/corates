/**
 * Retry wrappers for Durable Object sync operations
 *
 * These functions wrap the DO sync calls with automatic retry logic.
 * They handle transient failures gracefully without blocking the main operation,
 * since D1 is the source of truth and DO state will eventually sync on reconnect.
 */

import { syncMemberToDO, syncProjectToDO } from './project-sync';
import { withRetry } from './retry';
import { createLogger, type Logger } from './observability/logger';
import type { Env } from '../types';

interface MemberData {
  userId: string;
  role?: string;
  joinedAt?: number;
  name?: string | null;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  image?: string | null;
  [key: string]: unknown;
}

interface ProjectMeta {
  name?: string;
  description?: string | null;
  updatedAt?: number;
  createdAt?: number;
  [key: string]: unknown;
}

interface ProjectMember {
  userId: string;
  role: string;
  [key: string]: unknown;
}

/** Retry configuration for DO sync operations */
const DO_SYNC_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
} as const;

/**
 * Sync member to Durable Object with automatic retry
 *
 * This function wraps `syncMemberToDO` with retry logic. If all retries fail,
 * the error is logged but not thrown - the D1 write has already succeeded
 * and the DO will sync on next client connection.
 *
 * @example
 * ```typescript
 * await syncMemberWithRetry(env, projectId, 'add', {
 *   userId: user.id,
 *   role: 'member',
 *   joinedAt: Date.now(),
 * });
 * ```
 */
export async function syncMemberWithRetry(
  env: Env,
  projectId: string,
  action: 'add' | 'update' | 'remove',
  memberData: MemberData,
  logger?: Logger,
): Promise<void> {
  const log = logger || createLogger({ service: 'sync-member', env });

  const syncLogger = log.child({
    projectId,
    operation: `member-${action}`,
    userId: memberData.userId,
  });

  const result = await withRetry({
    operation: () => syncMemberToDO(env, projectId, action, memberData),
    ...DO_SYNC_RETRY_CONFIG,
    shouldRetry: shouldRetryDOSync,
    logger: syncLogger,
    operationName: `DO sync-member (${action})`,
  });

  if (!result.success) {
    // Log final failure but don't throw - D1 is source of truth
    // DO will sync on next client connection
    syncLogger.error('DO member sync exhausted all retries', {
      attempts: result.attempts,
      finalError: result.error instanceof Error ? result.error.message : String(result.error),
    });
  }
}

/**
 * Sync project metadata and members to Durable Object with automatic retry
 *
 * Similar to `syncMemberWithRetry` but for full project sync operations.
 * Used when creating projects or performing bulk updates.
 */
export async function syncProjectWithRetry(
  env: Env,
  projectId: string,
  meta: ProjectMeta | null,
  members: ProjectMember[] | null,
  logger?: Logger,
): Promise<void> {
  const log = logger || createLogger({ service: 'sync-project', env });

  const syncLogger = log.child({
    projectId,
    operation: 'project-sync',
  });

  const result = await withRetry({
    operation: () => syncProjectToDO(env, projectId, meta, members),
    ...DO_SYNC_RETRY_CONFIG,
    shouldRetry: shouldRetryDOSync,
    logger: syncLogger,
    operationName: 'DO sync-project',
  });

  if (!result.success) {
    syncLogger.error('DO project sync exhausted all retries', {
      attempts: result.attempts,
      finalError: result.error instanceof Error ? result.error.message : String(result.error),
    });
  }
}

/**
 * Determine if a DO sync error should be retried
 *
 * Only retries on server errors (5xx) and network errors.
 * Does NOT retry on client errors (4xx) as those indicate bugs in our code.
 */
function shouldRetryDOSync(error: unknown, _attempt: number): boolean {
  if (!(error instanceof Error)) {
    // Unknown error type - retry as it might be transient
    return true;
  }

  const message = error.message;

  // Extract status code from sync error messages
  // Format: "[ProjectSync] sync-member failed for project xxx: 503 ..."
  const statusMatch = message.match(/:\s*(\d{3})\s/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);

    // Only retry 5xx errors (server/DO errors)
    // Don't retry 4xx (client errors - indicates bug in our code)
    return status >= 500 && status < 600;
  }

  // For network errors, timeouts, etc. - retry
  // These typically don't have HTTP status codes in the message
  return true;
}
