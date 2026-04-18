/**
 * Retry wrapper around `syncMemberToDO`.
 *
 * D1 is the source of truth; if every retry fails the error is logged and
 * swallowed — the DO will resync on the next client connection.
 */
import { syncMemberToDO } from './project-sync';
import { withRetry } from './retry';
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

const DO_SYNC_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
} as const;

export async function syncMemberWithRetry(
  env: Env,
  projectId: string,
  action: 'add' | 'update' | 'remove',
  memberData: MemberData,
): Promise<void> {
  const logContext = { projectId, operation: `member-${action}`, userId: memberData.userId };

  const result = await withRetry({
    operation: () => syncMemberToDO(env, projectId, action, memberData),
    ...DO_SYNC_RETRY_CONFIG,
    shouldRetry: shouldRetryDOSync,
    logContext,
    operationName: `DO sync-member (${action})`,
  });

  if (!result.success) {
    console.error('[sync-member] DO member sync exhausted all retries', {
      ...logContext,
      attempts: result.attempts,
      finalError: result.error instanceof Error ? result.error.message : String(result.error),
    });
  }
}

/**
 * Retry only on 5xx / network errors. 4xx indicates a bug in our code, not a
 * transient failure, so we surface those immediately.
 */
function shouldRetryDOSync(error: unknown, _attempt: number): boolean {
  if (!(error instanceof Error)) return true;

  // Sync error format: "[ProjectSync] sync-member failed for project xxx: 503 ..."
  const statusMatch = error.message.match(/:\s*(\d{3})\s/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    return status >= 500 && status < 600;
  }

  return true;
}
