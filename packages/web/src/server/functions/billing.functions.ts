import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import {
  fetchUsage,
  fetchSubscription,
  fetchMembers,
  validateCoupon,
  fetchPlanValidation,
  createCheckout,
  fetchInvoices,
  createPortalSession,
  createSPCheckout,
  beginTrial,
  syncAfterCheckout,
} from './billing.server';

export const getUsage = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => fetchUsage(db, session));

export const getSubscription = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => fetchSubscription(db, session));

export const getMembers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session, request } }) =>
    fetchMembers(db, session, request.headers),
  );

export const checkCoupon = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ code: z.string() }))
  .handler(async ({ data }) => validateCoupon(data.code.trim()));

export const checkPlanChange = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ targetPlan: z.string() }))
  .handler(async ({ data, context: { db, session } }) =>
    fetchPlanValidation(db, session, data.targetPlan),
  );

export const checkoutSubscription = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      tier: z.string().min(1),
      interval: z.enum(['monthly', 'yearly']),
    }),
  )
  .handler(async ({ data, context: { db, session, request } }) =>
    createCheckout(db, session, request, data.tier, data.interval),
  );

export const getInvoices = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => fetchInvoices(db, session));

export const openBillingPortal = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session, request } }) =>
    createPortalSession(db, session, request),
  );

export const checkoutSingleProject = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session, request } }) =>
    createSPCheckout(db, session, request),
  );

export const startTrialGrant = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => beginTrial(db, session));

export const syncAfterSuccess = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => syncAfterCheckout(db, session));
