/**
 * Helper to resolve the org context from session or user's first membership
 * Extracts repeated pattern used across billing endpoints
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@/db/schema.js';

interface Session {
  activeOrganizationId?: string | null;
}

interface ResolveOrgParams {
  db: DrizzleD1Database<typeof schema>;
  session: Session | null;
  userId: string;
}

interface OrgIdWithRole {
  orgId: string | null;
  role: string | null;
}

/**
 * Get orgId from session's activeOrganizationId or user's first org
 * Verifies user is still a member of the org before returning
 */
export async function resolveOrgId({
  db,
  session,
  userId,
}: ResolveOrgParams): Promise<string | null> {
  const { member } = await import('@/db/schema.js');
  const { eq, and } = await import('drizzle-orm');

  const activeOrgId = session?.activeOrganizationId;

  if (activeOrgId) {
    // Verify user is still a member of the active org
    const membership = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(and(eq(member.organizationId, activeOrgId), eq(member.userId, userId)))
      .get();

    if (membership) {
      return activeOrgId;
    }
    // User is no longer a member of the active org, fall through to first membership
  }

  // Get user's first org membership
  const firstMembership = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1)
    .get();

  return firstMembership?.organizationId || null;
}

/**
 * Get orgId and membership role from session or user's first membership
 */
export async function resolveOrgIdWithRole({
  db,
  session,
  userId,
}: ResolveOrgParams): Promise<OrgIdWithRole> {
  let orgId = session?.activeOrganizationId;
  let role: string | null = null;

  if (!orgId) {
    const { member } = await import('@/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const firstMembership = await db
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1)
      .get();
    orgId = firstMembership?.organizationId;
    role = firstMembership?.role || null;
  } else {
    // Get role for active org
    const { member } = await import('@/db/schema.js');
    const { eq, and } = await import('drizzle-orm');
    const membership = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
      .get();
    role = membership?.role || null;
  }

  return { orgId: orgId || null, role };
}
