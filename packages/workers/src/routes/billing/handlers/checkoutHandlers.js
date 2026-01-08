/**
 * Checkout webhook event handlers
 *
 * Handles Stripe checkout.session events for one-time purchases.
 * This is the primary handler for single project grant purchases.
 */
import {
  getGrantByStripeCheckoutSessionId,
  getGrantByOrgIdAndType,
  createGrant,
  updateGrantExpiresAt,
} from '@/db/orgAccessGrants.js';

/**
 * Handle checkout.session.completed events
 *
 * Creates or extends org access grants for one-time purchases.
 * Only processes payment mode sessions with valid metadata.
 *
 * @param {import('stripe').Stripe.Checkout.Session} session - The completed checkout session
 * @param {object} ctx - Request context with db and logger
 * @returns {Promise<{handled: boolean, result: string, ledgerContext?: object}>}
 */
export async function handleCheckoutSessionCompleted(session, ctx) {
  const { db, logger } = ctx;

  // Only process payment mode (one-time purchases), not subscription mode
  if (session.mode !== 'payment') {
    logger.stripe('checkout_skipped_not_payment_mode', {
      sessionId: session.id,
      mode: session.mode,
    });
    return {
      handled: true,
      result: 'not_payment_mode',
      ledgerContext: {
        stripeCheckoutSessionId: session.id,
        mode: session.mode,
      },
    };
  }

  // Verify metadata contains required fields
  const orgId = session.metadata?.orgId;
  const grantType = session.metadata?.grantType;

  if (!orgId || grantType !== 'single_project') {
    logger.stripe('checkout_failed_invalid_metadata', {
      sessionId: session.id,
      metadata: session.metadata,
    });
    return {
      handled: true,
      result: 'invalid_metadata',
      error: 'missing_orgId_or_invalid_grantType',
      ledgerContext: {
        stripeCheckoutSessionId: session.id,
      },
    };
  }

  const purchaserUserId = session.metadata?.purchaserUserId;
  const stripeCustomerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;

  // Verify payment was successful
  if (session.payment_status !== 'paid') {
    logger.stripe('checkout_failed_not_paid', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return {
      handled: true,
      result: 'payment_not_paid',
      error: `payment_status:${session.payment_status}`,
      ledgerContext: {
        stripeCheckoutSessionId: session.id,
        orgId,
        stripeCustomerId,
      },
    };
  }

  // Check for idempotency - if grant already exists for this checkout session, skip
  const existingGrantBySession = await getGrantByStripeCheckoutSessionId(db, session.id);
  if (existingGrantBySession) {
    logger.stripe('checkout_skipped_already_processed', {
      sessionId: session.id,
      grantId: existingGrantBySession.id,
    });
    return {
      handled: true,
      result: 'already_processed',
      ledgerContext: {
        stripeCheckoutSessionId: session.id,
        orgId,
        stripeCustomerId,
        grantId: existingGrantBySession.id,
      },
    };
  }

  const now = new Date();
  const nowTimestamp = Math.floor(now.getTime() / 1000);

  // Check if org already has a single_project grant (active or expired, but not revoked)
  const existingGrant = await getGrantByOrgIdAndType(db, orgId, 'single_project');

  if (existingGrant && !existingGrant.revokedAt) {
    // Extension rule: expiresAt = max(now, currentExpiresAt) + 6 months
    const existingExpiresAtTimestamp =
      existingGrant.expiresAt instanceof Date ?
        Math.floor(existingGrant.expiresAt.getTime() / 1000)
      : existingGrant.expiresAt;

    const baseExpiresAt = Math.max(nowTimestamp, existingExpiresAtTimestamp);
    const newExpiresAt = new Date(baseExpiresAt * 1000);
    newExpiresAt.setMonth(newExpiresAt.getMonth() + 6);

    await updateGrantExpiresAt(db, existingGrant.id, newExpiresAt);

    logger.stripe('checkout_grant_extended', {
      sessionId: session.id,
      orgId,
      grantId: existingGrant.id,
      newExpiresAt: newExpiresAt.toISOString(),
    });

    return {
      handled: true,
      result: 'grant_extended',
      ledgerContext: {
        stripeCheckoutSessionId: session.id,
        orgId,
        stripeCustomerId,
        grantId: existingGrant.id,
        action: 'extended',
      },
    };
  }

  // Create new grant (6 months from now)
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 6);

  const grantId = crypto.randomUUID();
  await createGrant(db, {
    id: grantId,
    orgId,
    type: grantType,
    startsAt: now,
    expiresAt,
    stripeCheckoutSessionId: session.id,
    metadata: {
      purchaserUserId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
    },
  });

  logger.stripe('checkout_grant_created', {
    sessionId: session.id,
    orgId,
    grantId,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    handled: true,
    result: 'grant_created',
    ledgerContext: {
      stripeCheckoutSessionId: session.id,
      orgId,
      stripeCustomerId,
      grantId,
      action: 'created',
    },
  };
}
