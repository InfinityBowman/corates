/**
 * Billing invoices routes
 * Fetches invoices from Stripe for the current org's subscription
 */
import { Hono } from 'hono';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { createDb } from '@/db/client.js';
import { subscription } from '@/db/schema.js';
import { createDomainError, SYSTEM_ERRORS, AUTH_ERRORS } from '@corates/shared';
import { resolveOrgId } from './helpers/orgContext.js';
import { eq, desc, and, or } from 'drizzle-orm';
import Stripe from 'stripe';

const billingInvoicesRoutes = new Hono();

/**
 * GET /invoices
 * Get invoices for the current org's subscription
 * Returns up to 10 most recent invoices
 */
billingInvoicesRoutes.get('/invoices', requireAuth, async c => {
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
      apiVersion: '2024-06-20',
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
