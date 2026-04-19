/**
 * Admin Stripe customer subscriptions
 *
 * GET /api/admin/stripe/customer/:customerId/subscriptions — fetch all
 * subscriptions (any status) for a Stripe customer directly from Stripe. Used
 * by the admin dashboard to compare with our D1 subscription rows.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { createStripeClient } from '@corates/workers/stripe';
import type Stripe from 'stripe';
import { adminMiddleware } from '@/server/middleware/admin';

type HandlerArgs = { request: Request; params: { customerId: string } };

export const handleGet = async ({ params }: HandlerArgs) => {
  const { customerId } = params;

  if (!env.STRIPE_SECRET_KEY) {
    return Response.json(
      createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, { message: 'Stripe is not configured' }),
      { status: 500 },
    );
  }

  const stripe = createStripeClient(env);

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 20,
    });

    return Response.json(
      {
        customerId,
        subscriptions: subscriptions.data.map(sub => ({
          id: sub.id,
          status: sub.status,
          currency: sub.currency,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          cancelAt: sub.cancel_at,
          canceledAt: sub.canceled_at,
          endedAt: sub.ended_at,
          trialStart: sub.trial_start,
          trialEnd: sub.trial_end,
          created: sub.created,
          items: sub.items.data.map(item => ({
            id: item.id,
            priceId: item.price.id,
            productId: item.price.product,
            unitAmount: item.price.unit_amount,
            interval: item.price.recurring?.interval ?? null,
            currentPeriodStart: item.current_period_start,
            currentPeriodEnd: item.current_period_end,
            quantity: item.quantity,
          })),
          defaultPaymentMethod:
            typeof sub.default_payment_method === 'string' ?
              sub.default_payment_method
            : ((sub.default_payment_method as Stripe.PaymentMethod)?.id ?? null),
          latestInvoice:
            typeof sub.latest_invoice === 'string' ?
              sub.latest_invoice
            : ((sub.latest_invoice as Stripe.Invoice)?.id ?? null),
          metadata: sub.metadata as Record<string, string>,
        })),
        hasMore: subscriptions.has_more,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching subscriptions:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        service: 'Stripe',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/stripe/customer/$customerId/subscriptions')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
