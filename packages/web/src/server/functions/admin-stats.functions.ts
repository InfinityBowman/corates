import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import {
  getAdminStats,
  getAdminSignupStats,
  getAdminOrgStats,
  getAdminProjectStats,
  getAdminWebhookStats,
  getAdminSubscriptionStats,
  getAdminRevenueStats,
} from './admin-stats.server';

export const getAdminStatsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { session, db } }) => getAdminStats(session, db));

export const getAdminSignupStatsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ days: z.number().optional() }))
  .handler(async ({ data, context: { session, db } }) => getAdminSignupStats(session, db, data));

export const getAdminOrgStatsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ days: z.number().optional() }))
  .handler(async ({ data, context: { session, db } }) => getAdminOrgStats(session, db, data));

export const getAdminProjectStatsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ days: z.number().optional() }))
  .handler(async ({ data, context: { session, db } }) =>
    getAdminProjectStats(session, db, data),
  );

export const getAdminWebhookStatsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ days: z.number().optional() }))
  .handler(async ({ data, context: { session, db } }) =>
    getAdminWebhookStats(session, db, data),
  );

export const getAdminSubscriptionStatsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { session } }) => getAdminSubscriptionStats(session));

export const getAdminRevenueStatsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ months: z.number().optional() }))
  .handler(async ({ data, context: { session } }) => getAdminRevenueStats(session, data));
