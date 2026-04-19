/**
 * Billing invoices route
 *
 * GET /api/billing/invoices — fetches up to 10 most recent invoices from Stripe
 * for the current org's subscription. Returns an empty list when there's no
 * active/trialing subscription.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createStripeClient } from '@corates/workers/stripe';
import type { Database } from '@corates/db/client';
import { subscription } from '@corates/db/schema';
import { and, desc, eq, or } from 'drizzle-orm';
import {
  createDomainError,
  isDomainError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  type DomainError,
} from '@corates/shared';
import { resolveOrgId } from '@/server/billing-context';
import { dbMiddleware } from '@/server/middleware/db';

export const handleGet = async ({
  request,
  context: { db },
}: {
  request: Request;
  context: { db: Database };
}) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  try {
    const orgId = await resolveOrgId({
      db,
      session: session.session,
      userId: session.user.id,
    });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' });
      return Response.json(error, { status: 403 });
    }

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

    if (!orgSubscription?.stripeCustomerId) {
      return Response.json({ invoices: [] }, { status: 200 });
    }

    const stripe = createStripeClient(env);
    const stripeInvoices = await stripe.invoices.list({
      customer: orgSubscription.stripeCustomerId,
      limit: 10,
    });

    const invoices = stripeInvoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
      status: invoice.status as string | null,
      created: invoice.created,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      pdfUrl: invoice.invoice_pdf ?? null,
      hostedUrl: invoice.hosted_invoice_url ?? null,
    }));

    return Response.json({ invoices }, { status: 200 });
  } catch (err) {
    console.error('Error fetching invoices:', err);
    if (isDomainError(err)) {
      const domain = err as DomainError;
      return Response.json(domain, { status: domain.statusCode ?? 403 });
    }
    const error = err as Error;
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'fetch_invoices',
      originalError: error.message,
    });
    return Response.json(systemError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/billing/invoices')({
  server: { middleware: [dbMiddleware], handlers: { GET: handleGet } },
});
