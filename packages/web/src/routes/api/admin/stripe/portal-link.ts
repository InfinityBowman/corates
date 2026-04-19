/**
 * Admin Stripe portal-link
 *
 * POST /api/admin/stripe/portal-link — create a billing portal session for any
 * Stripe customer (admin tool, used to investigate live customer state).
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { createStripeClient } from '@corates/workers/stripe';
import { adminMiddleware } from '@/server/middleware/admin';

export const handlePost = async ({ request }: { request: Request }) => {
  let body: { customerId?: string; returnUrl?: string };
  try {
    body = (await request.json()) as { customerId?: string; returnUrl?: string };
  } catch {
    return Response.json(
      createValidationError('body', VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code, null, 'json'),
      { status: 400 },
    );
  }

  const customerId = body.customerId;
  const returnUrl = body.returnUrl;

  if (!customerId || typeof customerId !== 'string') {
    return Response.json(
      createValidationError('customerId', VALIDATION_ERRORS.FIELD_REQUIRED.code),
      { status: 400 },
    );
  }

  if (!env.STRIPE_SECRET_KEY) {
    return Response.json(
      createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, { message: 'Stripe is not configured' }),
      { status: 500 },
    );
  }

  const stripe = createStripeClient(env);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || env.APP_URL || 'https://corates.com',
    });

    return Response.json(
      {
        success: true,
        url: session.url,
        expiresAt: session.created + 300,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error creating portal link:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        service: 'Stripe',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/stripe/portal-link')({
  server: {
    middleware: [adminMiddleware],
    handlers: { POST: handlePost },
  },
});
