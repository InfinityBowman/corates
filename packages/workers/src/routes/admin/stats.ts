/**
 * Admin statistics routes for analytics and charts
 * Provides time-series data for signups, subscriptions, webhooks, etc.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createDb } from '@/db/client.js';
import { user, organization, stripeEventLedger, projects } from '@/db/schema.js';
import { sql, count, gte } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { createStripeClient } from '@/lib/stripe.js';
import { validationHook } from '@/lib/honoValidationHook.js';
import type { Env } from '../../types';

const statsRoutes = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

// Response schemas
const DailyCountSchema = z
  .object({
    date: z.string(),
    count: z.number(),
  })
  .openapi('DailyCount');

const SignupsResponseSchema = z
  .object({
    data: z.array(DailyCountSchema),
    total: z.number(),
    days: z.number(),
  })
  .openapi('SignupsResponse');

const OrganizationsResponseSchema = z
  .object({
    data: z.array(DailyCountSchema),
    total: z.number(),
    days: z.number(),
  })
  .openapi('OrganizationsStatsResponse');

const ProjectsStatsResponseSchema = z
  .object({
    data: z.array(DailyCountSchema),
    total: z.number(),
    days: z.number(),
  })
  .openapi('ProjectsStatsResponse');

const WebhookDaySchema = z
  .object({
    date: z.string(),
    success: z.number(),
    failed: z.number(),
    pending: z.number(),
  })
  .openapi('WebhookDay');

const WebhooksResponseSchema = z
  .object({
    data: z.array(WebhookDaySchema),
    totals: z.object({
      success: z.number(),
      failed: z.number(),
      pending: z.number(),
    }),
    days: z.number(),
  })
  .openapi('WebhooksResponse');

const SubscriptionsResponseSchema = z
  .object({
    active: z.number(),
    trialing: z.number(),
    pastDue: z.number(),
    canceled: z.number(),
    hasMore: z.boolean(),
  })
  .openapi('SubscriptionsResponse');

const MonthlyRevenueSchema = z
  .object({
    month: z.string(),
    label: z.string(),
    revenue: z.number(),
  })
  .openapi('MonthlyRevenue');

const RevenueResponseSchema = z
  .object({
    data: z.array(MonthlyRevenueSchema),
    total: z.number(),
    currency: z.string(),
    months: z.number(),
  })
  .openapi('RevenueResponse');

const StatsErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('StatsError');

// Route definitions
const signupsRoute = createRoute({
  method: 'get',
  path: '/signups',
  tags: ['Admin - Stats'],
  summary: 'Daily signup counts',
  description: 'Returns daily signup counts for the specified number of days. Admin only.',
  request: {
    query: z.object({
      days: z
        .string()
        .optional()
        .openapi({ description: 'Number of days to look back (max 90)', example: '30' }),
    }),
  },
  responses: {
    200: {
      description: 'Signup statistics',
      content: {
        'application/json': {
          schema: SignupsResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: StatsErrorSchema,
        },
      },
    },
  },
});

const organizationsRoute = createRoute({
  method: 'get',
  path: '/organizations',
  tags: ['Admin - Stats'],
  summary: 'Daily organization counts',
  description: 'Returns daily organization creation counts. Admin only.',
  request: {
    query: z.object({
      days: z
        .string()
        .optional()
        .openapi({ description: 'Number of days to look back (max 90)', example: '30' }),
    }),
  },
  responses: {
    200: {
      description: 'Organization statistics',
      content: {
        'application/json': {
          schema: OrganizationsResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: StatsErrorSchema,
        },
      },
    },
  },
});

const projectsRoute = createRoute({
  method: 'get',
  path: '/projects',
  tags: ['Admin - Stats'],
  summary: 'Daily project counts',
  description: 'Returns daily project creation counts. Admin only.',
  request: {
    query: z.object({
      days: z
        .string()
        .optional()
        .openapi({ description: 'Number of days to look back (max 90)', example: '30' }),
    }),
  },
  responses: {
    200: {
      description: 'Project statistics',
      content: {
        'application/json': {
          schema: ProjectsStatsResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: StatsErrorSchema,
        },
      },
    },
  },
});

const webhooksRoute = createRoute({
  method: 'get',
  path: '/webhooks',
  tags: ['Admin - Stats'],
  summary: 'Webhook event counts',
  description: 'Returns webhook event counts by day, grouped by success/failure. Admin only.',
  request: {
    query: z.object({
      days: z
        .string()
        .optional()
        .openapi({ description: 'Number of days to look back (max 30)', example: '7' }),
    }),
  },
  responses: {
    200: {
      description: 'Webhook statistics',
      content: {
        'application/json': {
          schema: WebhooksResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: StatsErrorSchema,
        },
      },
    },
  },
});

const subscriptionsRoute = createRoute({
  method: 'get',
  path: '/subscriptions',
  tags: ['Admin - Stats'],
  summary: 'Subscription status breakdown',
  description: 'Returns subscription status breakdown from Stripe. Admin only.',
  responses: {
    200: {
      description: 'Subscription statistics',
      content: {
        'application/json': {
          schema: SubscriptionsResponseSchema,
        },
      },
    },
    500: {
      description: 'Stripe API error',
      content: {
        'application/json': {
          schema: StatsErrorSchema,
        },
      },
    },
  },
});

const revenueRoute = createRoute({
  method: 'get',
  path: '/revenue',
  tags: ['Admin - Stats'],
  summary: 'Monthly revenue',
  description: 'Returns monthly revenue from Stripe. Admin only.',
  request: {
    query: z.object({
      months: z
        .string()
        .optional()
        .openapi({ description: 'Number of months to look back (max 12)', example: '6' }),
    }),
  },
  responses: {
    200: {
      description: 'Revenue statistics',
      content: {
        'application/json': {
          schema: RevenueResponseSchema,
        },
      },
    },
    500: {
      description: 'Stripe API error',
      content: {
        'application/json': {
          schema: StatsErrorSchema,
        },
      },
    },
  },
});

interface DailyCount {
  date: string | null;
  count: number;
}

/**
 * Helper function to fill missing days in time series data
 */
function fillMissingDays(
  results: DailyCount[],
  days: number,
): Array<{ date: string; count: number }> {
  const dateMap = new Map(results.map(r => [r.date, r.count]));
  const filledData: Array<{ date: string; count: number }> = [];

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

/**
 * GET /api/admin/stats/signups
 * Returns daily signup counts for the specified number of days
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
statsRoutes.openapi(signupsRoute, async c => {
  const db = createDb(c.env.DB);
  const query = c.req.valid('query');
  const days = Math.min(parseInt(query.days || '30', 10) || 30, 90);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // SQLite date aggregation for daily counts
    // Pass Date object to gte() since createdAt uses mode: 'timestamp'
    const results = await db
      .select({
        date: sql<string>`date(${user.createdAt}, 'unixepoch')`.as('date'),
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
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching signup stats:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_signup_stats',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * GET /api/admin/stats/organizations
 * Returns daily organization creation counts
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
statsRoutes.openapi(organizationsRoute, async c => {
  const db = createDb(c.env.DB);
  const query = c.req.valid('query');
  const days = Math.min(parseInt(query.days || '30', 10) || 30, 90);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Pass Date object to gte() since createdAt uses mode: 'timestamp'
    const results = await db
      .select({
        date: sql<string>`date(${organization.createdAt}, 'unixepoch')`.as('date'),
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
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching organization stats:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_stats',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * GET /api/admin/stats/projects
 * Returns daily project creation counts
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
statsRoutes.openapi(projectsRoute, async c => {
  const db = createDb(c.env.DB);
  const query = c.req.valid('query');
  const days = Math.min(parseInt(query.days || '30', 10) || 30, 90);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Pass Date object to gte() since createdAt uses mode: 'timestamp'
    const results = await db
      .select({
        date: sql<string>`date(${projects.createdAt}, 'unixepoch')`.as('date'),
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
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching project stats:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_project_stats',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

interface WebhookRow {
  date: string | null;
  status: string | null;
  count: number;
}

interface WebhookDayData {
  date: string;
  success: number;
  failed: number;
  pending: number;
}

/**
 * GET /api/admin/stats/webhooks
 * Returns webhook event counts by day, grouped by success/failure
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
statsRoutes.openapi(webhooksRoute, async c => {
  const db = createDb(c.env.DB);
  const query = c.req.valid('query');
  const days = Math.min(parseInt(query.days || '7', 10) || 7, 30);

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    const startTimestamp = startDate;

    // Query stripe event ledger grouped by date and status
    // processedAt is stored as unix timestamp
    const results = await db
      .select({
        date: sql<string>`date(${stripeEventLedger.processedAt}, 'unixepoch')`.as('date'),
        status: stripeEventLedger.status,
        count: count(),
      })
      .from(stripeEventLedger)
      .where(gte(stripeEventLedger.processedAt, startTimestamp))
      .groupBy(sql`date(${stripeEventLedger.processedAt}, 'unixepoch')`, stripeEventLedger.status)
      .orderBy(sql`date(${stripeEventLedger.processedAt}, 'unixepoch')`);

    // Transform into { date, success, failed, pending } format
    const dateMap = new Map<string, WebhookDayData>();
    for (const row of results as WebhookRow[]) {
      if (!row.date) continue;
      if (!dateMap.has(row.date)) {
        dateMap.set(row.date, { date: row.date, success: 0, failed: 0, pending: 0 });
      }
      const entry = dateMap.get(row.date)!;
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
    const filledData: WebhookDayData[] = [];
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
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching webhook stats:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_webhook_stats',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * GET /api/admin/stats/subscriptions
 * Returns subscription status breakdown from Stripe
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
statsRoutes.openapi(subscriptionsRoute, async c => {
  try {
    const stripe = createStripeClient(c.env);

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
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching subscription stats:', error);
    const stripeError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      service: 'Stripe',
      message: error.message,
    });
    return c.json(stripeError, stripeError.statusCode as ContentfulStatusCode);
  }
});

/**
 * GET /api/admin/stats/revenue
 * Returns monthly revenue from Stripe
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
statsRoutes.openapi(revenueRoute, async c => {
  const query = c.req.valid('query');
  const months = Math.min(parseInt(query.months || '6', 10) || 6, 12);

  try {
    const stripe = createStripeClient(c.env);

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
    const monthlyRevenue = new Map<string, number>();
    for (const invoice of invoices.data) {
      const date = new Date(invoice.created * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyRevenue.get(monthKey) || 0;
      monthlyRevenue.set(monthKey, existing + invoice.amount_paid);
    }

    // Fill missing months with zero
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

    return c.json({
      data,
      total: data.reduce((sum, d) => sum + d.revenue, 0),
      currency: 'usd',
      months,
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching revenue stats:', error);
    const stripeError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      service: 'Stripe',
      message: error.message,
    });
    return c.json(stripeError, stripeError.statusCode as ContentfulStatusCode);
  }
});

export { statsRoutes };
