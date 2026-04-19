/**
 * Admin signup stats
 *
 * GET /api/admin/stats/signups?days=N — daily user signup counts for last N
 * days (default 30, max 90), with missing days zero-filled.
 */
import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { user } from '@corates/db/schema';
import { count, gte, sql } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { adminMiddleware } from '@/server/middleware/admin';
import { fillMissingDays } from '@/server/lib/fillMissingDays';

export const handleGet = async ({
  request,
  context: { db },
}: {
  request: Request;
  context: { db: Database };
}) => {
  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10) || 30, 90);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const results = await db
      .select({
        date: sql<string>`date(${user.createdAt}, 'unixepoch')`.as('date'),
        count: count(),
      })
      .from(user)
      .where(gte(user.createdAt, startDate))
      .groupBy(sql`date(${user.createdAt}, 'unixepoch')`)
      .orderBy(sql`date(${user.createdAt}, 'unixepoch')`);

    const filled = fillMissingDays(results, days);

    return Response.json(
      {
        data: filled,
        total: filled.reduce((sum, d) => sum + d.count, 0),
        days,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching signup stats:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_signup_stats',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/stats/signups')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
