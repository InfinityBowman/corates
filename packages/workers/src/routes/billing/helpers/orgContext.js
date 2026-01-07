/**
 * Helper to resolve the org context from session or user's first membership
 * Extracts repeated pattern used across billing endpoints
 */

/**
 * Get orgId from session's activeOrganizationId or user's first org
 * @param {Object} params
 * @param {Object} params.db - Database client
 * @param {Object} params.session - User session (from getAuth)
 * @param {string} params.userId - User ID (from getAuth)
 * @returns {Promise<string|null>} orgId or null if not found
 */
export async function resolveOrgId({ db, session, userId }) {
  let orgId = session?.activeOrganizationId;

  // If no active org in session, get user's first org
  if (!orgId) {
    const { member } = await import('@/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const firstMembership = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1)
      .get();
    orgId = firstMembership?.organizationId;
  }

  return orgId || null;
}

/**
 * Get orgId and membership role from session or user's first membership
 * @param {Object} params
 * @param {Object} params.db - Database client
 * @param {Object} params.session - User session (from getAuth)
 * @param {string} params.userId - User ID (from getAuth)
 * @returns {Promise<{orgId: string|null, role: string|null}>}
 */
export async function resolveOrgIdWithRole({ db, session, userId }) {
  let orgId = session?.activeOrganizationId;
  let role = null;

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
