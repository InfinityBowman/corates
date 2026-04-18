/**
 * Post-checkout subscription sync route
 *
 * Called by the frontend when a user lands on /settings/billing with
 * ?success=true. Re-fetches the user's subscription from Stripe and
 * overwrites the local row, closing the race where Better Auth's webhook
 * hasn't arrived yet.
 */
import { OpenAPIHono, createRoute, z, $ } from '@hono/zod-openapi';
import { requireAuth, getAuth } from '../../middleware/auth.js';
import { createDb } from '@corates/db/client';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { syncStripeSubscription } from '../../commands';
import { validationHook } from '../../lib/honoValidationHook.js';
import type { Env } from '../../types';
import { ErrorResponseSchema } from '../../schemas/common.js';

const base = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

const SyncResponseSchema = z
  .object({
    status: z.string(),
    stripeSubscriptionId: z.string().nullable(),
  })
  .openapi('SyncAfterSuccessResponse');

const syncAfterSuccessRoute = createRoute({
  method: 'post',
  path: '/sync-after-success',
  tags: ['Billing'],
  summary: 'Sync subscription from Stripe',
  description:
    'Re-fetch the current user’s subscription from Stripe and overwrite the local row. Called from the /success redirect to beat the webhook race.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: SyncResponseSchema } },
      description: 'Subscription synced (or no-op if user has no Stripe customer)',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Not authenticated',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Internal error',
    },
  },
});

const billingSyncRoutes = $(base.use('*', requireAuth)).openapi(syncAfterSuccessRoute, async c => {
  const { user } = getAuth(c);

  if (!user) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, 401);
  }

  if (!user.stripeCustomerId) {
    return c.json({ status: 'none', stripeSubscriptionId: null }, 200);
  }

  try {
    const db = createDb(c.env.DB);
    const result = await syncStripeSubscription(c.env, db, user.stripeCustomerId);
    return c.json(result, 200);
  } catch (err) {
    const error = err as Error;
    console.error('sync-after-success failed:', error);
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'sync_stripe_subscription',
      originalError: error.message,
    });
    return c.json(systemError, 500);
  }
});

export { billingSyncRoutes };
