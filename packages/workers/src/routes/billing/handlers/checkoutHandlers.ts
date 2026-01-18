/**
 * Checkout webhook event handlers
 *
 * Handles Stripe checkout.session events for one-time purchases.
 * Delegates to the processCheckoutSession command for business logic.
 */
import type Stripe from 'stripe';
import { processCheckoutSession } from '@/commands';
import type { WebhookContext, WebhookResult } from './types.js';
import type { Database } from '@/db/client';

interface ProcessCheckoutContext {
  db: Database;
  logger: {
    stripe: (_event: string, _context: Record<string, unknown>) => void;
  };
}

/**
 * Handle checkout.session.completed events
 *
 * Creates or extends org access grants for one-time purchases.
 * Only processes payment mode sessions with valid metadata.
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  // Cast context to match processCheckoutSession expectations
  const processCtx: ProcessCheckoutContext = {
    db: ctx.db as Database,
    logger: {
      stripe: ctx.logger.stripe,
    },
  };
  // Delegate to the command for all business logic
  return processCheckoutSession(session, processCtx);
}
