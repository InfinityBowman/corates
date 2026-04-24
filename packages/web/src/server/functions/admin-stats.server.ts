import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import {
  user,
  projects,
  session as sessionTable,
  organization,
  stripeEventLedger,
} from '@corates/db/schema';
import { count, gte, sql } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { isAdminUser } from '@corates/workers/auth-admin';
import { TIME_DURATIONS } from '@corates/workers/constants';
import { createStripeClient } from '@corates/workers/stripe';
import { fillMissingDays } from '@/server/lib/fillMissingDays';
import type { Session } from '@/server/middleware/auth';

function assertAdmin(session: Session) {
  if (!isAdminUser(session.user as { role?: string | null })) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' }),
      { status: 403 },
    );
  }
}

export async function getAdminStats(session: Session, db: Database) {
  assertAdmin(session);

  const [userCount, projectCount, sessionCount] = await Promise.all([
    db.select({ count: count() }).from(user),
    db.select({ count: count() }).from(projects),
    db.select({ count: count() }).from(sessionTable),
  ]);

  const sevenDaysAgo = Math.floor(Date.now() / 1000) - TIME_DURATIONS.STATS_RECENT_DAYS_SEC;
  const [recentSignups] = await db
    .select({ count: count() })
    .from(user)
    .where(sql`${user.createdAt} > ${sevenDaysAgo}`);

  return {
    users: userCount[0]?.count || 0,
    projects: projectCount[0]?.count || 0,
    activeSessions: sessionCount[0]?.count || 0,
    recentSignups: recentSignups?.count || 0,
  };
}

export async function getAdminSignupStats(
  session: Session,
  db: Database,
  params: { days?: number },
) {
  assertAdmin(session);
  const days = Math.min(params.days ?? 30, 90);

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

  return {
    data: filled,
    total: filled.reduce((sum, d) => sum + d.count, 0),
    days,
  };
}

export async function getAdminOrgStats(
  session: Session,
  db: Database,
  params: { days?: number },
) {
  assertAdmin(session);
  const days = Math.min(params.days ?? 30, 90);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const results = await db
    .select({
      date: sql<string>`date(${organization.createdAt}, 'unixepoch')`.as('date'),
      count: count(),
    })
    .from(organization)
    .where(gte(organization.createdAt, startDate))
    .groupBy(sql`date(${organization.createdAt}, 'unixepoch')`)
    .orderBy(sql`date(${organization.createdAt}, 'unixepoch')`);

  const filled = fillMissingDays(results, days);

  return {
    data: filled,
    total: filled.reduce((sum, d) => sum + d.count, 0),
    days,
  };
}

export async function getAdminProjectStats(
  session: Session,
  db: Database,
  params: { days?: number },
) {
  assertAdmin(session);
  const days = Math.min(params.days ?? 30, 90);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const results = await db
    .select({
      date: sql<string>`date(${projects.createdAt}, 'unixepoch')`.as('date'),
      count: count(),
    })
    .from(projects)
    .where(gte(projects.createdAt, startDate))
    .groupBy(sql`date(${projects.createdAt}, 'unixepoch')`)
    .orderBy(sql`date(${projects.createdAt}, 'unixepoch')`);

  const filled = fillMissingDays(results, days);

  return {
    data: filled,
    total: filled.reduce((sum, d) => sum + d.count, 0),
    days,
  };
}

export async function getAdminWebhookStats(
  session: Session,
  db: Database,
  params: { days?: number },
) {
  assertAdmin(session);
  const days = Math.min(params.days ?? 7, 30);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

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

  interface WebhookDayData {
    date: string;
    success: number;
    failed: number;
    pending: number;
  }

  const dateMap = new Map<string, WebhookDayData>();
  for (const row of results) {
    const date = row.date as string | null;
    if (!date) continue;
    if (!dateMap.has(date)) {
      dateMap.set(date, { date, success: 0, failed: 0, pending: 0 });
    }
    const entry = dateMap.get(date)!;
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

  return {
    data: filled,
    totals: {
      success: filled.reduce((sum, d) => sum + d.success, 0),
      failed: filled.reduce((sum, d) => sum + d.failed, 0),
      pending: filled.reduce((sum, d) => sum + d.pending, 0),
    },
    days,
  };
}

export async function getAdminSubscriptionStats(session: Session) {
  assertAdmin(session);

  const stripe = createStripeClient(env);
  const statusCounts = await Promise.all([
    stripe.subscriptions.search({ query: 'status:"active"', limit: 100 }),
    stripe.subscriptions.search({ query: 'status:"trialing"', limit: 100 }),
    stripe.subscriptions.search({ query: 'status:"past_due"', limit: 100 }),
    stripe.subscriptions.search({ query: 'status:"canceled"', limit: 100 }),
  ]);

  return {
    active: statusCounts[0].data.length,
    trialing: statusCounts[1].data.length,
    pastDue: statusCounts[2].data.length,
    canceled: statusCounts[3].data.length,
    hasMore: statusCounts.some(r => r.has_more),
  };
}

export async function getAdminRevenueStats(
  session: Session,
  params: { months?: number },
) {
  assertAdmin(session);
  const months = Math.min(params.months ?? 6, 12);

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

  return {
    data,
    total: data.reduce((sum, d) => sum + d.revenue, 0),
    currency: 'usd' as const,
    months,
  };
}
