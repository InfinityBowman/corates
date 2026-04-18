/**
 * Admin Stripe customer invoices
 *
 * GET /api/admin/stripe/customer/:customerId/invoices?limit=N — list invoices
 * for any Stripe customer directly from Stripe (default 10, max 50).
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { createStripeClient } from '@corates/workers/stripe';
import type Stripe from 'stripe';
import { requireAdmin } from '@/server/guards/requireAdmin';

interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription | null;
}

type HandlerArgs = { request: Request; params: { customerId: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { customerId } = params;
  const url = new URL(request.url);
  const parsedLimit = parseInt(url.searchParams.get('limit') || '10', 10);
  const limit = Math.min(Number.isNaN(parsedLimit) ? 10 : parsedLimit, 50);

  if (!env.STRIPE_SECRET_KEY) {
    return Response.json(
      createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, { message: 'Stripe is not configured' }),
      { status: 500 },
    );
  }

  const stripe = createStripeClient(env);

  try {
    const invoices = await stripe.invoices.list({ customer: customerId, limit });

    return Response.json(
      {
        customerId,
        invoices: invoices.data.map(inv => {
          const invWithSub = inv as InvoiceWithSubscription;
          return {
            id: inv.id,
            number: inv.number,
            status: inv.status,
            currency: inv.currency,
            amountDue: inv.amount_due,
            amountPaid: inv.amount_paid,
            amountRemaining: inv.amount_remaining,
            total: inv.total,
            subtotal: inv.subtotal,
            created: inv.created,
            dueDate: inv.due_date,
            paidAt: inv.status_transitions?.paid_at ?? null,
            hostedInvoiceUrl: inv.hosted_invoice_url,
            invoicePdf: inv.invoice_pdf,
            subscriptionId:
              typeof invWithSub.subscription === 'string' ?
                invWithSub.subscription
              : ((invWithSub.subscription as Stripe.Subscription)?.id ?? null),
            periodStart: inv.period_start,
            periodEnd: inv.period_end,
          };
        }),
        hasMore: invoices.has_more,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching invoices:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        service: 'Stripe',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/stripe/customer/$customerId/invoices')({
  server: { handlers: { GET: handleGet } },
});
