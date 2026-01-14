import { count, eq } from 'drizzle-orm';
import { resolveOrgAccess } from './billingResolver';
import { isUnlimitedQuota } from '@corates/shared/plans';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
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
  const orgBilling = await resolveOrgAccess(db, orgId);
  const limit = (orgBilling.quotas as unknown as Record<string, number>)[quotaKey];

  if (isUnlimitedQuota(limit)) {
    return { allowed: true, used: 0, limit: -1 };
  }

  const [result] = await db
    .select({ count: count() })
    .from(table)
    .where(eq(whereColumn, orgId) as SQL<unknown>);

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

interface InsertWithQuotaOptions {
  orgId: string;
  quotaKey: string;
  countTable: SQLiteTable;
  countColumn: SQLiteColumn;
  insertStatements: unknown[];
}

interface InsertWithQuotaResult {
  success: boolean;
  error?: ReturnType<typeof createDomainError>;
}

export async function insertWithQuotaCheck(
  db: Database,
  options: InsertWithQuotaOptions,
): Promise<InsertWithQuotaResult> {
  const { orgId, quotaKey, countTable, countColumn, insertStatements } = options;

  const orgBilling = await resolveOrgAccess(db, orgId);
  const limit = (orgBilling.quotas as unknown as Record<string, number>)[quotaKey];

  if (isUnlimitedQuota(limit)) {
    await db.batch(insertStatements as unknown as Parameters<typeof db.batch>[0]);
    return { success: true };
  }

  const [countResult] = await db
    .select({ count: count() })
    .from(countTable)
    .where(eq(countColumn, orgId) as SQL<unknown>);

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

  await db.batch(insertStatements as unknown as Parameters<typeof db.batch>[0]);

  const [verifyResult] = await db
    .select({ count: count() })
    .from(countTable)
    .where(eq(countColumn, orgId) as SQL<unknown>);

  const newCount = verifyResult?.count || 0;

  if (newCount > limit) {
    console.warn(
      `[QuotaTransaction] Race condition detected: ${quotaKey} exceeded for org ${orgId}. ` +
        `Count: ${newCount}, Limit: ${limit}. Consider rollback or manual intervention.`,
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

  const orgBilling = await resolveOrgAccess(db, orgId);
  const limit = orgBilling.quotas['collaborators.org.max'];

  if (isUnlimitedQuota(limit)) {
    return { allowed: true, used: 0, limit: -1 };
  }

  const [result] = await db
    .select({ count: count() })
    .from(member)
    .where(and(eq(member.organizationId, orgId), ne(member.role, 'owner')));

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
