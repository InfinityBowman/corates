/**
 * Checkout webhook event handlers
 *
 * Handles Stripe checkout.session events for one-time purchases.
 * Delegates to the processCheckoutSession command for business logic.
 */
import { processCheckoutSession } from '@/commands';

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
  // Delegate to the command for all business logic
  return processCheckoutSession(session, ctx);
}
