/**
 * Post-checkout subscription sync route
 *
 * Called by the frontend when a user lands on /settings/billing with
 * ?success=true. Re-fetches the user's subscription from Stripe and
 * overwrites the local row, closing the race where Better Auth's webhook
 * hasn't arrived yet.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { syncStripeSubscription } from '@corates/workers/commands/billing';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { authMiddleware, type Session } from '@/server/middleware/auth';

export const handlePost = async ({
  context: { db, session },
}: {
  request: Request;
  context: { db: Database; session: Session };
}) => {
  const stripeCustomerId = session.user.stripeCustomerId as string | null | undefined;
  if (!stripeCustomerId) {
    return Response.json({ status: 'none', stripeSubscriptionId: null }, { status: 200 });
  }

  try {
    const result = await syncStripeSubscription(env, db, stripeCustomerId);
    return Response.json(result, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('sync-after-success failed:', error);
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'sync_stripe_subscription',
      originalError: error.message,
    });
    return Response.json(systemError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/billing/sync-after-success')({
  server: { middleware: [authMiddleware], handlers: { POST: handlePost } },
});
