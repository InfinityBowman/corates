/**
 * Admin webhook stats
 *
 * GET /api/admin/stats/webhooks?days=N — daily Stripe event counts grouped by
 * status: processed → success, failed → failed, received → pending. Default 7
 * days, max 30.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { stripeEventLedger } from '@corates/db/schema';
import { count, gte, sql } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';

interface WebhookDayData {
  date: string;
  success: number;
  failed: number;
  pending: number;
}

interface WebhookRow {
  date: string | null;
  status: string | null;
  count: number;
}

export const handleGet = async ({ request }: { request: Request }) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '7', 10) || 7, 30);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const db = createDb(env.DB);
    const results = await db
      .select({
        date: sql<string>`date(${stripeEventLedger.processedAt}, 'unixepoch')`.as('date'),
        status: stripeEventLedger.status,
        count: count(),
      })
      .from(stripeEventLedger)
      .where(gte(stripeEventLedger.processedAt, startDate))
      .groupBy(sql`date(${stripeEventLedger.processedAt}, 'unixepoch')`, stripeEventLedger.status)
      .orderBy(sql`date(${stripeEventLedger.processedAt}, 'unixepoch')`);

    const dateMap = new Map<string, WebhookDayData>();
    for (const row of results as WebhookRow[]) {
      if (!row.date) continue;
      if (!dateMap.has(row.date)) {
        dateMap.set(row.date, { date: row.date, success: 0, failed: 0, pending: 0 });
      }
      const entry = dateMap.get(row.date)!;
      if (row.status === 'processed') entry.success = row.count;
      else if (row.status === 'failed') entry.failed = row.count;
      else if (row.status === 'received') entry.pending = row.count;
    }

    const filled: WebhookDayData[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      filled.push(dateMap.get(dateStr) || { date: dateStr, success: 0, failed: 0, pending: 0 });
    }

    return Response.json(
      {
        data: filled,
        totals: {
          success: filled.reduce((sum, d) => sum + d.success, 0),
          failed: filled.reduce((sum, d) => sum + d.failed, 0),
          pending: filled.reduce((sum, d) => sum + d.pending, 0),
        },
        days,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching webhook stats:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_webhook_stats',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/stats/webhooks')({
  server: { handlers: { GET: handleGet } },
});
