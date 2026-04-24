import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import {
  lookupAdminStripeCustomer,
  createAdminStripePortalLink,
  getAdminStripeCustomerInvoices,
  getAdminStripeCustomerPaymentMethods,
  getAdminStripeCustomerSubscriptions,
} from './admin-stripe.server';

export const lookupAdminStripeCustomerAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      email: z.string().optional(),
      customerId: z.string().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) =>
    lookupAdminStripeCustomer(session, db, data),
  );

export const createAdminStripePortalLinkAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      customerId: z.string(),
      returnUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data, context: { session } }) =>
    createAdminStripePortalLink(session, data),
  );

export const getAdminStripeCustomerInvoicesAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      customerId: z.string(),
      limit: z.number().optional(),
    }),
  )
  .handler(async ({ data, context: { session } }) =>
    getAdminStripeCustomerInvoices(session, data),
  );

export const getAdminStripeCustomerPaymentMethodsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ customerId: z.string() }))
  .handler(async ({ data, context: { session } }) =>
    getAdminStripeCustomerPaymentMethods(session, data),
  );

export const getAdminStripeCustomerSubscriptionsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ customerId: z.string() }))
  .handler(async ({ data, context: { session } }) =>
    getAdminStripeCustomerSubscriptions(session, data),
  );
