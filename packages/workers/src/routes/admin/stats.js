/**
 * Admin statistics routes for analytics and charts
 * Provides time-series data for signups, subscriptions, webhooks, etc.
 */

import { Hono } from 'hono';
import { createDb } from '@/db/client.js';
import { user, organization, stripeEventLedger, projects } from '@/db/schema.js';
import { sql, count, gte } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import Stripe from 'stripe';

const statsRoutes = new Hono();

/**
 * GET /api/admin/stats/signups
 * Returns daily signup counts for the specified number of days
 * Query params:
 *   - days: number of days to look back (default 30, max 90)
 */
statsRoutes.get('/signups', async c => {
  const db = createDb(c.env.DB);
  const days = Math.min(parseInt(c.req.query('days') || '30', 10), 90);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // SQLite date aggregation for daily counts
    // Pass Date object to gte() since createdAt uses mode: 'timestamp'
    const results = await db
      .select({
        date: sql`date(${user.createdAt}, 'unixepoch')`.as('date'),
        count: count(),
      })
      .from(user)
      .where(gte(user.createdAt, startDate))
      .groupBy(sql`date(${user.createdAt}, 'unixepoch')`)
      .orderBy(sql`date(${user.createdAt}, 'unixepoch')`);

    // Fill in missing days with zero counts
    const filledData = fillMissingDays(results, days);

    return c.json({
      data: filledData,
      total: filledData.reduce((sum, d) => sum + d.count, 0),
      days,
    });
  } catch (error) {
    console.error('Error fetching signup stats:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_signup_stats',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/stats/organizations
 * Returns daily organization creation counts
 * Query params:
 *   - days: number of days to look back (default 30, max 90)
 */
statsRoutes.get('/organizations', async c => {
  const db = createDb(c.env.DB);
  const days = Math.min(parseInt(c.req.query('days') || '30', 10), 90);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Pass Date object to gte() since createdAt uses mode: 'timestamp'
    const results = await db
      .select({
        date: sql`date(${organization.createdAt}, 'unixepoch')`.as('date'),
        count: count(),
      })
      .from(organization)
      .where(gte(organization.createdAt, startDate))
      .groupBy(sql`date(${organization.createdAt}, 'unixepoch')`)
      .orderBy(sql`date(${organization.createdAt}, 'unixepoch')`);

    const filledData = fillMissingDays(results, days);

    return c.json({
      data: filledData,
      total: filledData.reduce((sum, d) => sum + d.count, 0),
      days,
    });
  } catch (error) {
    console.error('Error fetching organization stats:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_stats',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/stats/projects
 * Returns daily project creation counts
 * Query params:
 *   - days: number of days to look back (default 30, max 90)
 */
statsRoutes.get('/projects', async c => {
  const db = createDb(c.env.DB);
  const days = Math.min(parseInt(c.req.query('days') || '30', 10), 90);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Pass Date object to gte() since createdAt uses mode: 'timestamp'
    const results = await db
      .select({
        date: sql`date(${projects.createdAt}, 'unixepoch')`.as('date'),
        count: count(),
      })
      .from(projects)
      .where(gte(projects.createdAt, startDate))
      .groupBy(sql`date(${projects.createdAt}, 'unixepoch')`)
      .orderBy(sql`date(${projects.createdAt}, 'unixepoch')`);

    const filledData = fillMissingDays(results, days);

    return c.json({
      data: filledData,
      total: filledData.reduce((sum, d) => sum + d.count, 0),
      days,
    });
  } catch (error) {
    console.error('Error fetching project stats:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_project_stats',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/stats/webhooks
 * Returns webhook event counts by day, grouped by success/failure
 * Query params:
 *   - days: number of days to look back (default 7, max 30)
 */
statsRoutes.get('/webhooks', async c => {
  const db = createDb(c.env.DB);
  const days = Math.min(parseInt(c.req.query('days') || '7', 10), 30);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    const startTimestamp = startDate;

    // Query stripe event ledger grouped by date and status
    // processedAt is stored as unix timestamp
    const results = await db
      .select({
        date: sql`date(${stripeEventLedger.processedAt}, 'unixepoch')`.as('date'),
        status: stripeEventLedger.status,
        count: count(),
      })
      .from(stripeEventLedger)
      .where(gte(stripeEventLedger.processedAt, startTimestamp))
      .groupBy(sql`date(${stripeEventLedger.processedAt}, 'unixepoch')`, stripeEventLedger.status)
      .orderBy(sql`date(${stripeEventLedger.processedAt}, 'unixepoch')`);

    // Transform into { date, success, failed, pending } format
    const dateMap = new Map();
    for (const row of results) {
      if (!dateMap.has(row.date)) {
        dateMap.set(row.date, { date: row.date, success: 0, failed: 0, pending: 0 });
      }
      const entry = dateMap.get(row.date);
      // Map status values: processed -> success, failed -> failed, received -> pending
      if (row.status === 'processed') {
        entry.success = row.count;
      } else if (row.status === 'failed') {
        entry.failed = row.count;
      } else if (row.status === 'received') {
        entry.pending = row.count;
      }
    }

    // Fill missing days
    const filledData = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = dateMap.get(dateStr);
      filledData.push(existing || { date: dateStr, success: 0, failed: 0, pending: 0 });
    }

    return c.json({
      data: filledData,
      totals: {
        success: filledData.reduce((sum, d) => sum + d.success, 0),
        failed: filledData.reduce((sum, d) => sum + d.failed, 0),
        pending: filledData.reduce((sum, d) => sum + d.pending, 0),
      },
      days,
    });
  } catch (error) {
    console.error('Error fetching webhook stats:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_webhook_stats',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/stats/subscriptions
 * Returns subscription status breakdown from Stripe
 */
statsRoutes.get('/subscriptions', async c => {
  try {
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    });

    // Use search to get actual counts
    const statusCounts = await Promise.all([
      stripe.subscriptions.search({ query: 'status:"active"', limit: 100 }),
      stripe.subscriptions.search({ query: 'status:"trialing"', limit: 100 }),
      stripe.subscriptions.search({ query: 'status:"past_due"', limit: 100 }),
      stripe.subscriptions.search({ query: 'status:"canceled"', limit: 100 }),
    ]);

    return c.json({
      active: statusCounts[0].data.length,
      trialing: statusCounts[1].data.length,
      pastDue: statusCounts[2].data.length,
      canceled: statusCounts[3].data.length,
      hasMore: statusCounts.some(r => r.has_more),
    });
  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    const stripeError = createDomainError(SYSTEM_ERRORS.EXTERNAL_SERVICE_ERROR, {
      service: 'Stripe',
      message: error.message,
    });
    return c.json(stripeError, stripeError.statusCode);
  }
});

/**
 * GET /api/admin/stats/revenue
 * Returns monthly revenue from Stripe
 * Query params:
 *   - months: number of months to look back (default 6, max 12)
 */
statsRoutes.get('/revenue', async c => {
  const months = Math.min(parseInt(c.req.query('months') || '6', 10), 12);

  try {
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    });

    // Calculate date range
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    // Fetch paid invoices within the date range
    const invoices = await stripe.invoices.list({
      status: 'paid',
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
      },
      limit: 100,
    });

    // Aggregate by month
    const monthlyRevenue = new Map();
    for (const invoice of invoices.data) {
      const date = new Date(invoice.created * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyRevenue.get(monthKey) || 0;
      monthlyRevenue.set(monthKey, existing + invoice.amount_paid);
    }

    // Fill missing months with zero
    const data = [];
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

    return c.json({
      data,
      total: data.reduce((sum, d) => sum + d.revenue, 0),
      currency: 'usd',
      months,
    });
  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    return c.json(
      {
        data: [],
        total: 0,
        currency: 'usd',
        error: error.message,
      },
      200,
    );
  }
});

/**
 * Helper function to fill missing days in time series data
 */
function fillMissingDays(results, days) {
  const dateMap = new Map(results.map(r => [r.date, r.count]));
  const filledData = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    filledData.push({
      date: dateStr,
      count: dateMap.get(dateStr) || 0,
    });
  }

  return filledData;
}

export { statsRoutes };
