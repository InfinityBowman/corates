/**
 * Admin subscription stats
 *
 * GET /api/admin/stats/subscriptions — counts active/trialing/pastDue/canceled
 * subscriptions via Stripe `subscriptions.search` (limit 100 each).
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createStripeClient } from '@corates/workers/stripe';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { adminMiddleware } from '@/server/middleware/admin';

export const handleGet = async () => {
  try {
    const stripe = createStripeClient(env);
    const statusCounts = await Promise.all([
      stripe.subscriptions.search({ query: 'status:"active"', limit: 100 }),
      stripe.subscriptions.search({ query: 'status:"trialing"', limit: 100 }),
      stripe.subscriptions.search({ query: 'status:"past_due"', limit: 100 }),
      stripe.subscriptions.search({ query: 'status:"canceled"', limit: 100 }),
    ]);

    return Response.json(
      {
        active: statusCounts[0].data.length,
        trialing: statusCounts[1].data.length,
        pastDue: statusCounts[2].data.length,
        canceled: statusCounts[3].data.length,
        hasMore: statusCounts.some(r => r.has_more),
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching subscription stats:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        service: 'Stripe',
        message: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/stats/subscriptions')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
