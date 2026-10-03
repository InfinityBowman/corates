import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { OrgId } from '@corates/shared/ids';
import { authMiddleware } from '@/server/middleware/auth';
import {
  fetchUsage,
  fetchSubscription,
  fetchPlanValidation,
  createCheckout,
  fetchInvoices,
  createPortalSession,
  syncAfterCheckout,
} from './billing.server';

const orgInput = z.object({ orgId: z.string() });

export const getUsage = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(orgInput)
  .handler(async ({ data, context: { db, session } }) =>
    fetchUsage(db, session, data.orgId as OrgId),
  );

export const getSubscription = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(orgInput)
  .handler(async ({ data, context: { db, session } }) =>
    fetchSubscription(db, session, data.orgId as OrgId),
  );

export const checkPlanChange = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(orgInput.extend({ targetPlan: z.string() }))
  .handler(async ({ data, context: { db, session } }) =>
    fetchPlanValidation(db, session, data.orgId as OrgId, data.targetPlan),
  );

export const checkoutSubscription = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    orgInput.extend({
      tier: z.string().min(1),
      interval: z.enum(['monthly', 'yearly']),
    }),
  )
  .handler(async ({ data, context: { db, session, request } }) =>
    createCheckout(db, session, request, data.orgId as OrgId, data.tier, data.interval),
  );

export const getInvoices = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(orgInput)
  .handler(async ({ data, context: { db, session } }) =>
    fetchInvoices(db, session, data.orgId as OrgId),
  );

export const openBillingPortal = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(orgInput)
  .handler(async ({ data, context: { db, session, request } }) =>
    createPortalSession(db, session, request, data.orgId as OrgId),
  );

export const syncAfterSuccess = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => syncAfterCheckout(db, session));
