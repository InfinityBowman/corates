/**
 * Admin revenue stats
 *
 * GET /api/admin/stats/revenue?months=N — monthly paid-invoice revenue from
 * Stripe (default 6 months, max 12). Missing months zero-filled. Currency hard-
 * coded to USD.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createStripeClient } from '@corates/workers/stripe';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';

export const handleGet = async ({ request }: { request: Request }) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const months = Math.min(parseInt(url.searchParams.get('months') || '6', 10) || 6, 12);

  try {
    const stripe = createStripeClient(env);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const invoices = await stripe.invoices.list({
      status: 'paid',
      created: { gte: Math.floor(startDate.getTime() / 1000) },
      limit: 100,
    });

    const monthlyRevenue = new Map<string, number>();
    for (const invoice of invoices.data) {
      const date = new Date(invoice.created * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyRevenue.get(monthKey) || 0;
      monthlyRevenue.set(monthKey, existing + invoice.amount_paid);
    }

    const data: Array<{ month: string; label: string; revenue: number }> = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      data.push({
        month: monthKey,
        label: monthName,
        revenue: monthlyRevenue.get(monthKey) || 0,
      });
    }

    return Response.json(
      {
        data,
        total: data.reduce((sum, d) => sum + d.revenue, 0),
        currency: 'usd',
        months,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching revenue stats:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        service: 'Stripe',
        message: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/stats/revenue')({
  server: { handlers: { GET: handleGet } },
});
