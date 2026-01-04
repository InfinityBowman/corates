/**
 * Org access grants database queries
 */

import { eq, and, isNull, desc } from 'drizzle-orm';
import { orgAccessGrants } from './schema.js';

/**
 * Get all grants for an organization
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} orgId - Organization ID
 * @returns {Promise<Array>}
 */
export async function getGrantsByOrgId(db, orgId) {
  const results = await db
    .select()
    .from(orgAccessGrants)
    .where(eq(orgAccessGrants.orgId, orgId))
    .orderBy(desc(orgAccessGrants.createdAt))
    .all();

  return results;
}

/**
 * Get active grants for an organization (not expired, not revoked)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} orgId - Organization ID
 * @param {Date} now - Current timestamp
 * @returns {Promise<Array>}
 */
export async function getActiveGrantsByOrgId(db, orgId, now) {
  const nowTimestamp = now instanceof Date ? Math.floor(now.getTime() / 1000) : now;
  const results = await db
    .select()
    .from(orgAccessGrants)
    .where(
      and(
        eq(orgAccessGrants.orgId, orgId),
        isNull(orgAccessGrants.revokedAt),
        // startsAt <= now
        // expiresAt > now (handled in query or post-filter)
      ),
    )
    .orderBy(desc(orgAccessGrants.expiresAt))
    .all();

  // Filter by time range (Drizzle doesn't easily support complex timestamp comparisons)
  return results.filter(grant => {
    const startsAt = grant.startsAt instanceof Date ?
        Math.floor(grant.startsAt.getTime() / 1000)
      : grant.startsAt;
    const expiresAt = grant.expiresAt instanceof Date ?
        Math.floor(grant.expiresAt.getTime() / 1000)
      : grant.expiresAt;
    return startsAt <= nowTimestamp && nowTimestamp < expiresAt;
  });
}

/**
 * Get a specific grant by ID
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} grantId - Grant ID
 * @returns {Promise<Object | null>}
 */
export async function getGrantById(db, grantId) {
  const result = await db
    .select()
    .from(orgAccessGrants)
    .where(eq(orgAccessGrants.id, grantId))
    .get();

  return result ?? null;
}

/**
 * Create a new grant
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {Object} data - Grant data
 * @returns {Promise<Object>}
 */
export async function createGrant(db, data) {
  const {
    id,
    orgId,
    type,
    startsAt,
    expiresAt,
    stripeCheckoutSessionId = null,
    metadata = null,
  } = data;

  const result = await db
    .insert(orgAccessGrants)
    .values({
      id,
      orgId,
      type,
      startsAt,
      expiresAt,
      stripeCheckoutSessionId,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date(),
    })
    .returning()
    .get();

  return result;
}

/**
 * Update a grant's expiresAt (for extending single_project grants)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} grantId - Grant ID
 * @param {Date} newExpiresAt - New expiration date
 * @returns {Promise<Object | null>}
 */
export async function updateGrantExpiresAt(db, grantId, newExpiresAt) {
  const result = await db
    .update(orgAccessGrants)
    .set({
      expiresAt: newExpiresAt,
    })
    .where(eq(orgAccessGrants.id, grantId))
    .returning()
    .get();

  return result ?? null;
}

/**
 * Revoke a grant
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} grantId - Grant ID
 * @returns {Promise<Object | null>}
 */
export async function revokeGrant(db, grantId) {
  const result = await db
    .update(orgAccessGrants)
    .set({
      revokedAt: new Date(),
    })
    .where(eq(orgAccessGrants.id, grantId))
    .returning()
    .get();

  return result ?? null;
}

/**
 * Check if an org has an existing grant of a specific type
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} orgId - Organization ID
 * @param {string} type - Grant type ('trial' | 'single_project')
 * @returns {Promise<Object | null>}
 */
export async function getGrantByOrgIdAndType(db, orgId, type) {
  const result = await db
    .select()
    .from(orgAccessGrants)
    .where(and(eq(orgAccessGrants.orgId, orgId), eq(orgAccessGrants.type, type)))
    .orderBy(desc(orgAccessGrants.createdAt))
    .get();

  return result ?? null;
}

/**
 * Get a grant by Stripe checkout session ID (for idempotency)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} stripeCheckoutSessionId - Stripe checkout session ID
 * @returns {Promise<Object | null>}
 */
export async function getGrantByStripeCheckoutSessionId(db, stripeCheckoutSessionId) {
  const result = await db
    .select()
    .from(orgAccessGrants)
    .where(eq(orgAccessGrants.stripeCheckoutSessionId, stripeCheckoutSessionId))
    .get();

  return result ?? null;
}
