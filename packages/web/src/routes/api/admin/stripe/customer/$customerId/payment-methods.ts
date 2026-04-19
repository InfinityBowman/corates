/**
 * Admin Stripe customer payment methods
 *
 * GET /api/admin/stripe/customer/:customerId/payment-methods — list card
 * payment methods attached to any Stripe customer.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { createStripeClient } from '@corates/workers/stripe';
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
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return Response.json(
      {
        customerId,
        paymentMethods: paymentMethods.data.map(pm => ({
          id: pm.id,
          type: pm.type,
          card:
            pm.card ?
              {
                brand: pm.card.brand,
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year,
                funding: pm.card.funding,
                country: pm.card.country,
              }
            : null,
          created: pm.created,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching payment methods:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        service: 'Stripe',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/stripe/customer/$customerId/payment-methods')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
