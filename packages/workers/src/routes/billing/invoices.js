/**
 * Billing invoices routes
 * Fetches invoices from Stripe for the current org's subscription
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { createDb } from '@/db/client.js';
import { subscription } from '@/db/schema.js';
import { createDomainError, SYSTEM_ERRORS, AUTH_ERRORS } from '@corates/shared';
import { resolveOrgId } from './helpers/orgContext.js';
import { eq, desc, and, or } from 'drizzle-orm';
import Stripe from 'stripe';
import { validationHook } from '@/lib/honoValidationHook.js';

const billingInvoicesRoutes = new OpenAPIHono({
  defaultHook: validationHook,
});

// Response schemas
const InvoiceSchema = z.object({
  id: z.string(),
  number: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  status: z.string().nullable(),
  created: z.number(),
  periodStart: z.number(),
  periodEnd: z.number(),
  pdfUrl: z.string().nullable(),
  hostedUrl: z.string().nullable(),
});

const InvoicesResponseSchema = z
  .object({
    invoices: z.array(InvoiceSchema),
  })
  .openapi('InvoicesResponse');

const InvoicesErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('InvoicesError');

// Route definitions
const getInvoicesRoute = createRoute({
  method: 'get',
  path: '/invoices',
  tags: ['Billing'],
  summary: 'Get invoices',
  description:
    "Get invoices for the current org's subscription. Returns up to 10 most recent invoices.",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: InvoicesResponseSchema } },
      description: 'Invoices list',
    },
    403: {
      content: { 'application/json': { schema: InvoicesErrorSchema } },
      description: 'No org found',
    },
    500: {
      content: { 'application/json': { schema: InvoicesErrorSchema } },
      description: 'Internal error',
    },
  },
});

// Route handlers
billingInvoicesRoutes.use('*', requireAuth);

billingInvoicesRoutes.openapi(getInvoicesRoute, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const orgId = await resolveOrgId({ db, session, userId: user.id });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'no_org_found',
      });
      return c.json(error, error.statusCode);
    }

    // Get the subscription for this org to find the Stripe customer ID
    const [orgSubscription] = await db
      .select({
        stripeCustomerId: subscription.stripeCustomerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      })
      .from(subscription)
      .where(
        and(
          eq(subscription.referenceId, orgId),
          or(eq(subscription.status, 'active'), eq(subscription.status, 'trialing')),
        ),
      )
      .orderBy(desc(subscription.createdAt))
      .limit(1);

    // If no subscription found, return empty invoices
    if (!orgSubscription?.stripeCustomerId) {
      return c.json({ invoices: [] });
    }

    // Initialize Stripe client
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    });

    // Fetch invoices from Stripe
    const stripeInvoices = await stripe.invoices.list({
      customer: orgSubscription.stripeCustomerId,
      limit: 10,
    });

    // Transform invoices to frontend-compatible format
    const invoices = stripeInvoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_paid / 100, // Convert from cents
      currency: invoice.currency,
      status: invoice.status,
      created: invoice.created,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
    }));

    return c.json({ invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);

    // If error is already a domain error, return it as-is
    if (error.code && error.statusCode) {
      return c.json(error, error.statusCode);
    }

    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'fetch_invoices',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

export { billingInvoicesRoutes };
