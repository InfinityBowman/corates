/**
 * Billing context resolver
 *
 * Replaces packages/workers/src/routes/billing/helpers/orgContext.ts. Used by
 * the migrated TanStack billing routes to figure out which org a billing call
 * applies to (active org from session, or first membership) and the caller's
 * role in that org.
 */
import { createDb } from '@corates/db/client';
import { member } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';

interface SessionLike {
  activeOrganizationId?: string | null;
  [key: string]: unknown;
}

interface ResolveOrgIdParams {
  db: ReturnType<typeof createDb>;
  session: SessionLike | null;
  userId: string;
}

export async function resolveOrgId({
  db,
  session,
  userId,
}: ResolveOrgIdParams): Promise<string | null> {
  const activeOrgId = session?.activeOrganizationId;
  try {
    if (activeOrgId) {
      const membership = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(and(eq(member.organizationId, activeOrgId), eq(member.userId, userId)))
        .get();
      if (membership) return activeOrgId;
    }

    const firstMembership = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1)
      .get();

    return firstMembership?.organizationId || null;
  } catch (err) {
    throw createDomainError(SYSTEM_ERRORS.DB_ERROR, { cause: err });
  }
}

export async function resolveOrgIdWithRole({
  db,
  session,
  userId,
}: ResolveOrgIdParams): Promise<{ orgId: string | null; role: string | null }> {
  let orgId = session?.activeOrganizationId ?? null;
  let role: string | null = null;

  if (!orgId) {
    const firstMembership = await db
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1)
      .get();
    orgId = firstMembership?.organizationId ?? null;
    role = firstMembership?.role ?? null;
  } else {
    const membership = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
      .get();
    role = membership?.role ?? null;
  }

  return { orgId, role };
}
