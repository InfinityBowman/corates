import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import { getAdminBillingLedger, getAdminBillingStuckStates } from './admin-billing.server';

export const getAdminBillingLedgerAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      limit: z.number().optional(),
      status: z.string().optional(),
      type: z.string().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) =>
    getAdminBillingLedger(session, db, data),
  );

export const getAdminBillingStuckStatesAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      incompleteThreshold: z.number().optional(),
      limit: z.number().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) =>
    getAdminBillingStuckStates(session, db, data),
  );
