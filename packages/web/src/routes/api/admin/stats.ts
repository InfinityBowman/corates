/**
 * Admin dashboard statistics
 *
 * GET /api/admin/stats — top-line counts (users, projects, active sessions,
 * recent signups in the last 7 days). Sub-paths under stats/* (signups,
 * organizations, projects, webhooks, subscriptions, revenue) are separate
 * route files.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { user, projects, session } from '@corates/db/schema';
import { count, sql } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { TIME_DURATIONS } from '@corates/workers/constants';
import { requireAdmin } from '@/server/guards/requireAdmin';

export const handleGet = async ({ request }: { request: Request }) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const db = createDb(env.DB);

  try {
    const [userCount, projectCount, sessionCount] = await Promise.all([
      db.select({ count: count() }).from(user),
      db.select({ count: count() }).from(projects),
      db.select({ count: count() }).from(session),
    ]);

    const sevenDaysAgo = Math.floor(Date.now() / 1000) - TIME_DURATIONS.STATS_RECENT_DAYS_SEC;
    const [recentSignups] = await db
      .select({ count: count() })
      .from(user)
      .where(sql`${user.createdAt} > ${sevenDaysAgo}`);

    return Response.json(
      {
        users: userCount[0]?.count || 0,
        projects: projectCount[0]?.count || 0,
        activeSessions: sessionCount[0]?.count || 0,
        recentSignups: recentSignups?.count || 0,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching admin stats:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_admin_stats',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/stats')({
  server: { handlers: { GET: handleGet } },
});
