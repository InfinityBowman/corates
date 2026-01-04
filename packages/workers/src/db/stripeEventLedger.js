/**
 * Stripe event ledger database queries
 * Two-phase trust model for webhook observability:
 * - Phase 1: Insert trust-minimal fields on receipt (before verification)
 * - Phase 2: Update with verified fields only after signature verification succeeds
 */

import { eq } from 'drizzle-orm';
import { stripeEventLedger } from './schema.js';

/**
 * Ledger status values
 */
export const LedgerStatus = {
  RECEIVED: 'received',
  PROCESSED: 'processed',
  SKIPPED_DUPLICATE: 'skipped_duplicate',
  FAILED: 'failed',
  IGNORED_UNVERIFIED: 'ignored_unverified',
};

/**
 * Insert a new ledger entry on webhook receipt (Phase 1 - trust-minimal)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {Object} data - Ledger entry data
 * @returns {Promise<Object>} Created ledger entry
 */
export async function insertLedgerEntry(db, data) {
  const {
    id,
    payloadHash,
    signaturePresent,
    route,
    requestId,
    status = LedgerStatus.RECEIVED,
    error = null,
    httpStatus = null,
  } = data;

  const result = await db
    .insert(stripeEventLedger)
    .values({
      id,
      payloadHash,
      signaturePresent,
      receivedAt: new Date(),
      route,
      requestId,
      status,
      error,
      httpStatus,
      // All verified fields start as null
      stripeEventId: null,
      type: null,
      livemode: null,
      apiVersion: null,
      created: null,
      processedAt: null,
      orgId: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeCheckoutSessionId: null,
    })
    .returning()
    .get();

  return result;
}

/**
 * Update ledger entry with verified fields after signature verification (Phase 2)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} id - Ledger entry ID
 * @param {Object} data - Verified fields to update
 * @returns {Promise<Object | null>} Updated ledger entry
 */
export async function updateLedgerWithVerifiedFields(db, id, data) {
  const {
    stripeEventId,
    type,
    livemode,
    apiVersion,
    created,
    status,
    httpStatus,
    error = null,
    // Optional linking fields
    orgId = null,
    stripeCustomerId = null,
    stripeSubscriptionId = null,
    stripeCheckoutSessionId = null,
  } = data;

  const updateData = {
    processedAt: new Date(),
    status,
    ...(httpStatus !== undefined && { httpStatus }),
    ...(error !== undefined && { error }),
  };

  // Only populate verified fields if status indicates successful verification
  if (status === LedgerStatus.PROCESSED) {
    Object.assign(updateData, {
      stripeEventId,
      type,
      livemode,
      apiVersion,
      created,
      orgId,
      stripeCustomerId,
      stripeSubscriptionId,
      stripeCheckoutSessionId,
    });
  }

  const result = await db
    .update(stripeEventLedger)
    .set(updateData)
    .where(eq(stripeEventLedger.id, id))
    .returning()
    .get();

  return result ?? null;
}

/**
 * Update ledger entry status without verified fields (for failures/ignored)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} id - Ledger entry ID
 * @param {Object} data - Status update data
 * @returns {Promise<Object | null>} Updated ledger entry
 */
export async function updateLedgerStatus(db, id, data) {
  const { status, error = null, httpStatus = null } = data;

  const result = await db
    .update(stripeEventLedger)
    .set({
      status,
      error,
      httpStatus,
      processedAt: new Date(),
    })
    .where(eq(stripeEventLedger.id, id))
    .returning()
    .get();

  return result ?? null;
}

/**
 * Get ledger entry by payload hash (for dedupe before verification)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} payloadHash - SHA-256 hash of raw request body
 * @returns {Promise<Object | null>} Ledger entry or null
 */
export async function getLedgerByPayloadHash(db, payloadHash) {
  const result = await db
    .select()
    .from(stripeEventLedger)
    .where(eq(stripeEventLedger.payloadHash, payloadHash))
    .get();

  return result ?? null;
}

/**
 * Get ledger entry by Stripe event ID (for dedupe after verification)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} stripeEventId - Stripe event ID
 * @returns {Promise<Object | null>} Ledger entry or null
 */
export async function getLedgerByStripeEventId(db, stripeEventId) {
  const result = await db
    .select()
    .from(stripeEventLedger)
    .where(eq(stripeEventLedger.stripeEventId, stripeEventId))
    .get();

  return result ?? null;
}

/**
 * Get ledger entry by ID
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} id - Ledger entry ID
 * @returns {Promise<Object | null>} Ledger entry or null
 */
export async function getLedgerById(db, id) {
  const result = await db
    .select()
    .from(stripeEventLedger)
    .where(eq(stripeEventLedger.id, id))
    .get();

  return result ?? null;
}

/**
 * Get recent ledger entries for an org (for reconciliation)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} orgId - Organization ID
 * @param {Object} options - Query options
 * @param {number} [options.limit=50] - Maximum number of entries
 * @param {Date} [options.since] - Only entries after this date
 * @returns {Promise<Array>} Ledger entries
 */
export async function getLedgerEntriesByOrgId(db, orgId, options = {}) {
  const { limit = 50 } = options;

  const results = await db
    .select()
    .from(stripeEventLedger)
    .where(eq(stripeEventLedger.orgId, orgId))
    .orderBy(stripeEventLedger.receivedAt)
    .limit(limit)
    .all();

  return results;
}

/**
 * Get ledger entries by event type (for reconciliation)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} type - Stripe event type
 * @param {Object} options - Query options
 * @param {number} [options.limit=50] - Maximum number of entries
 * @returns {Promise<Array>} Ledger entries
 */
export async function getLedgerEntriesByType(db, type, options = {}) {
  const { limit = 50 } = options;

  const results = await db
    .select()
    .from(stripeEventLedger)
    .where(eq(stripeEventLedger.type, type))
    .orderBy(stripeEventLedger.receivedAt)
    .limit(limit)
    .all();

  return results;
}

/**
 * Get ledger entries by status (for monitoring/alerting)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} status - Ledger status
 * @param {Object} options - Query options
 * @param {number} [options.limit=100] - Maximum number of entries
 * @returns {Promise<Array>} Ledger entries
 */
export async function getLedgerEntriesByStatus(db, status, options = {}) {
  const { limit = 100 } = options;

  const results = await db
    .select()
    .from(stripeEventLedger)
    .where(eq(stripeEventLedger.status, status))
    .orderBy(stripeEventLedger.receivedAt)
    .limit(limit)
    .all();

  return results;
}

/**
 * Get processed checkout.session.completed events without corresponding subscription
 * Used for detecting "checkout completed but no subscription created" stuck state
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {Object} options - Query options
 * @param {number} [options.minutesAgo=30] - Only events older than this
 * @param {number} [options.limit=50] - Maximum number of entries
 * @returns {Promise<Array>} Ledger entries
 */
export async function getProcessedCheckoutSessionsWithoutSubscription(db, options = {}) {
  const { limit = 50 } = options;

  // Get all processed checkout.session.completed events
  const results = await db
    .select()
    .from(stripeEventLedger)
    .where(eq(stripeEventLedger.type, 'checkout.session.completed'))
    .orderBy(stripeEventLedger.receivedAt)
    .limit(limit)
    .all();

  // Filter to only processed status
  return results.filter(entry => entry.status === LedgerStatus.PROCESSED);
}
