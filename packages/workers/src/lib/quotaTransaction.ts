import { count, eq } from 'drizzle-orm';
import { resolveOrgAccess } from './billingResolver';
import { isUnlimitedQuota } from '@corates/shared/plans';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import type { Database } from '../db/client';
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { SQL } from 'drizzle-orm';

interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  error?: ReturnType<typeof createDomainError>;
}

export async function checkQuotaForInsert(
  db: Database,
  orgId: string,
  quotaKey: string,
  table: SQLiteTable,
  whereColumn: SQLiteColumn,
): Promise<QuotaCheckResult> {
  let orgBilling;
  try {
    orgBilling = await resolveOrgAccess(db, orgId);
  } catch (err) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      error: createDomainError(
        SYSTEM_ERRORS.DB_ERROR,
        { reason: 'db_query_failed', quotaKey, orgId },
        `DB query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      ),
    };
  }

  const limit = orgBilling.quotas[quotaKey];

  if (limit === undefined) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      error: createDomainError(
        SYSTEM_ERRORS.INTERNAL_ERROR,
        { reason: 'invalid_quota_key', quotaKey, orgId },
        `Invalid quota key: ${quotaKey}`,
      ),
    };
  }

  if (isUnlimitedQuota(limit)) {
    return { allowed: true, used: 0, limit: -1 };
  }

  let result;
  try {
    [result] = await db
      .select({ count: count() })
      .from(table)
      .where(eq(whereColumn, orgId) as SQL<unknown>);
  } catch (err) {
    return {
      allowed: false,
      used: 0,
      limit,
      error: createDomainError(
        SYSTEM_ERRORS.DB_ERROR,
        { reason: 'db_query_failed', quotaKey, orgId },
        `DB query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      ),
    };
  }

  const used = result?.count || 0;

  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      error: createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'quota_exceeded', quotaKey, used, limit, requested: 1 },
        `Quota exceeded: ${quotaKey}. Current usage: ${used}, Limit: ${limit}`,
      ),
    };
  }

  return { allowed: true, used, limit };
}

/**
 * Metadata for rollback in case of race condition
 * Each entry represents one inserted record that can be rolled back
 */
export interface InsertRollbackMeta {
  table: SQLiteTable;
  idColumn: SQLiteColumn;
  id: string;
}

interface InsertWithQuotaOptions {
  orgId: string;
  quotaKey: string;
  countTable: SQLiteTable;
  countColumn: SQLiteColumn;
  insertStatements: unknown[];
  /**
   * Optional rollback metadata for race condition handling.
   * If provided and a race condition is detected (post-insert count exceeds limit),
   * these records will be deleted and an error returned.
   * Order matters: records are deleted in reverse order to respect FK constraints.
   */
  rollbackMeta?: InsertRollbackMeta[];
}

interface InsertWithQuotaResult {
  success: boolean;
  error?: ReturnType<typeof createDomainError>;
}

export async function insertWithQuotaCheck(
  db: Database,
  options: InsertWithQuotaOptions,
): Promise<InsertWithQuotaResult> {
  const { orgId, quotaKey, countTable, countColumn, insertStatements, rollbackMeta } = options;

  let orgBilling;
  try {
    orgBilling = await resolveOrgAccess(db, orgId);
  } catch (err) {
    return {
      success: false,
      error: createDomainError(
        SYSTEM_ERRORS.DB_ERROR,
        { reason: 'db_query_failed', quotaKey, orgId },
        `DB query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      ),
    };
  }

  const limit = orgBilling.quotas[quotaKey];

  if (limit === undefined) {
    return {
      success: false,
      error: createDomainError(
        SYSTEM_ERRORS.INTERNAL_ERROR,
        { reason: 'invalid_quota_key', quotaKey, orgId },
        `Invalid quota key: ${quotaKey}`,
      ),
    };
  }

  if (isUnlimitedQuota(limit)) {
    try {
      await db.batch(insertStatements as unknown as Parameters<typeof db.batch>[0]);
    } catch (err) {
      return {
        success: false,
        error: createDomainError(
          SYSTEM_ERRORS.DB_ERROR,
          { reason: 'db_query_failed', quotaKey, orgId },
          `DB query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        ),
      };
    }
    return { success: true };
  }

  let countResult;
  try {
    [countResult] = await db
      .select({ count: count() })
      .from(countTable)
      .where(eq(countColumn, orgId) as SQL<unknown>);
  } catch (err) {
    return {
      success: false,
      error: createDomainError(
        SYSTEM_ERRORS.DB_ERROR,
        { reason: 'db_query_failed', quotaKey, orgId },
        `DB query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      ),
    };
  }

  const used = countResult?.count || 0;

  if (used >= limit) {
    return {
      success: false,
      error: createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'quota_exceeded', quotaKey, used, limit, requested: 1 },
        `Quota exceeded: ${quotaKey}. Current usage: ${used}, Limit: ${limit}`,
      ),
    };
  }

  try {
    await db.batch(insertStatements as unknown as Parameters<typeof db.batch>[0]);
  } catch (err) {
    return {
      success: false,
      error: createDomainError(
        SYSTEM_ERRORS.DB_ERROR,
        { reason: 'db_query_failed', quotaKey, orgId },
        `DB query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      ),
    };
  }

  let verifyResult;
  try {
    [verifyResult] = await db
      .select({ count: count() })
      .from(countTable)
      .where(eq(countColumn, orgId) as SQL<unknown>);
  } catch (err) {
    return {
      success: false,
      error: createDomainError(
        SYSTEM_ERRORS.DB_ERROR,
        { reason: 'db_query_failed', quotaKey, orgId },
        `DB query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      ),
    };
  }

  const newCount = verifyResult?.count || 0;

  if (newCount > limit) {
    // Race condition detected - quota exceeded after insert
    console.error(
      `[QuotaTransaction] Race condition detected: ${quotaKey} exceeded for org ${orgId}. ` +
        `Count: ${newCount}, Limit: ${limit}. Attempting rollback.`,
    );

    // If rollback metadata provided, delete the inserted records
    if (rollbackMeta && rollbackMeta.length > 0) {
      // Delete in reverse order to respect FK constraints (e.g., projectMembers before projects)
      for (let i = rollbackMeta.length - 1; i >= 0; i--) {
        const { table, idColumn, id } = rollbackMeta[i];
        try {
          await db.delete(table).where(eq(idColumn, id));
        } catch (deleteErr) {
          // Log but continue - best effort rollback
          console.error(
            `[QuotaTransaction] Failed to rollback record during race condition cleanup:`,
            { table: table._.name, id, error: deleteErr },
          );
        }
      }

      return {
        success: false,
        error: createDomainError(
          AUTH_ERRORS.FORBIDDEN,
          {
            reason: 'quota_exceeded_race',
            quotaKey,
            used: newCount,
            limit,
            requested: 1,
            retryable: true,
          },
          `Quota exceeded due to concurrent request: ${quotaKey}. ` +
            `Current usage: ${newCount}, Limit: ${limit}. Please retry your request.`,
        ),
      };
    }

    // No rollback metadata - log warning but allow (legacy behavior for backward compatibility)
    console.warn(
      `[QuotaTransaction] No rollback metadata provided. ` +
        `Over-quota records will remain. Consider providing rollbackMeta.`,
    );
  }

  return { success: true };
}

export async function checkCollaboratorQuota(
  db: Database,
  orgId: string,
): Promise<QuotaCheckResult> {
  const { member } = await import('../db/schema');
  const { and, ne } = await import('drizzle-orm');

  let orgBilling;
  try {
    orgBilling = await resolveOrgAccess(db, orgId);
  } catch (err) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      error: createDomainError(
        SYSTEM_ERRORS.DB_ERROR,
        { reason: 'db_query_failed', quotaKey: 'collaborators.org.max', orgId },
        `DB query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      ),
    };
  }

  const limit = orgBilling.quotas['collaborators.org.max'];

  if (isUnlimitedQuota(limit)) {
    return { allowed: true, used: 0, limit: -1 };
  }

  let result;
  try {
    [result] = await db
      .select({ count: count() })
      .from(member)
      .where(and(eq(member.organizationId, orgId), ne(member.role, 'owner')));
  } catch (err) {
    return {
      allowed: false,
      used: 0,
      limit,
      error: createDomainError(
        SYSTEM_ERRORS.DB_ERROR,
        { reason: 'db_query_failed', quotaKey: 'collaborators.org.max', orgId },
        `DB query failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      ),
    };
  }

  const used = result?.count || 0;

  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      error: createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'quota_exceeded', quotaKey: 'collaborators.org.max', used, limit, requested: 1 },
        `Collaborator quota exceeded. Current: ${used}, Limit: ${limit}. ` +
          'Upgrade your plan to add more team members.',
      ),
    };
  }

  return { allowed: true, used, limit };
}
