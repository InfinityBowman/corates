/**
 * Admin billing ledger
 *
 * GET /api/admin/billing/ledger — recent Stripe event ledger entries with
 * status/type filters and per-status / per-type counts.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { stripeEventLedger } from '@corates/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';

export const handleGet = async ({ request }: { request: Request }) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const status = url.searchParams.get('status') || undefined;
  const eventType = url.searchParams.get('type') || undefined;

  const db = createDb(env.DB);

  try {
    const conditions = [];
    if (status) conditions.push(eq(stripeEventLedger.status, status));
    if (eventType) conditions.push(eq(stripeEventLedger.type, eventType));

    const entries =
      conditions.length > 0 ?
        await db
          .select()
          .from(stripeEventLedger)
          .where(and(...conditions))
          .orderBy(desc(stripeEventLedger.receivedAt))
          .limit(limit)
          .all()
      : await db
          .select()
          .from(stripeEventLedger)
          .orderBy(desc(stripeEventLedger.receivedAt))
          .limit(limit)
          .all();

    const stats = {
      total: entries.length,
      byStatus: entries.reduce(
        (acc, e) => {
          acc[e.status] = (acc[e.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byType: entries
        .filter(e => e.type)
        .reduce(
          (acc, e) => {
            if (e.type) acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
    };

    return Response.json(
      {
        stats,
        entries: entries.map(e => ({
          id: e.id,
          stripeEventId: e.stripeEventId,
          type: e.type,
          status: e.status,
          httpStatus: e.httpStatus,
          error: e.error,
          orgId: e.orgId,
          stripeCustomerId: e.stripeCustomerId,
          stripeSubscriptionId: e.stripeSubscriptionId,
          stripeCheckoutSessionId: e.stripeCheckoutSessionId,
          payloadHash: e.payloadHash,
          signaturePresent: e.signaturePresent,
          livemode: e.livemode,
          receivedAt: e.receivedAt,
          processedAt: e.processedAt,
          requestId: e.requestId,
          route: e.route,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching ledger:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_ledger',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/billing/ledger')({
  server: { handlers: { GET: handleGet } },
});
