import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import {
  fetchUsage,
  fetchSubscription,
  fetchMembers,
  validateCoupon,
  fetchPlanValidation,
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
