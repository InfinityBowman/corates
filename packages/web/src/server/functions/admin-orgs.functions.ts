import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { OrgId, OrgAccessGrantId } from '@corates/shared/ids';
import { authMiddleware } from '@/server/middleware/auth';
import {
  listAdminOrgs,
  getAdminOrgDetails,
  getAdminOrgBilling,
  reconcileAdminOrgBilling,
  createAdminGrant,
  updateAdminGrant,
  revokeAdminGrant,
  grantAdminTrial,
  grantAdminSingleProject,
  createAdminSubscription,
  updateAdminSubscription,
  cancelAdminSubscription,
} from './admin-orgs.server';

export const getAdminOrgsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      page: z.number().optional(),
      limit: z.number().optional(),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => listAdminOrgs(session, db, data));

export const getAdminOrgDetailsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    getAdminOrgDetails(session, db, data.orgId as OrgId),
  );

export const getAdminOrgBillingAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    getAdminOrgBilling(session, db, data.orgId as OrgId),
  );

export const getAdminOrgBillingReconcileAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      checkStripe: z.boolean().optional(),
      incompleteThreshold: z.number().optional(),
      checkoutNoSubThreshold: z.number().optional(),
      processingLagThreshold: z.number().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, ...params } = data;
    return reconcileAdminOrgBilling(session, db, orgId as OrgId, params);
  });

export const createGrantAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      type: z.enum(['trial', 'single_project']),
      startsAt: z.coerce.date(),
      expiresAt: z.coerce.date(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, ...grantData } = data;
    return createAdminGrant(session, db, orgId as OrgId, grantData);
  });

export const updateGrantAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      grantId: z.string(),
      expiresAt: z.coerce.date().optional(),
      revokedAt: z.coerce.date().optional().nullable(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, grantId, ...updateData } = data;
    return updateAdminGrant(session, db, orgId as OrgId, grantId as OrgAccessGrantId, updateData);
  });

export const revokeGrantAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string(), grantId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    revokeAdminGrant(session, db, data.orgId as OrgId, data.grantId as OrgAccessGrantId),
  );

export const grantTrialAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    grantAdminTrial(session, db, data.orgId as OrgId),
  );

export const grantSingleProjectAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    grantAdminSingleProject(session, db, data.orgId as OrgId),
  );

export const createSubscriptionAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      plan: z.enum(['starter_team', 'team', 'unlimited_team']),
      status: z.enum(['active', 'trialing', 'past_due', 'paused', 'canceled', 'unpaid']),
      periodStart: z.coerce.date().optional(),
      periodEnd: z.coerce.date().optional(),
      stripeCustomerId: z.string().optional(),
      stripeSubscriptionId: z.string().optional(),
      cancelAtPeriodEnd: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, ...subData } = data;
    return createAdminSubscription(session, db, orgId as OrgId, subData);
  });

export const updateSubscriptionAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      subscriptionId: z.string(),
      plan: z.enum(['starter_team', 'team', 'unlimited_team']).optional(),
      status: z
        .enum(['active', 'trialing', 'past_due', 'paused', 'canceled', 'unpaid', 'incomplete'])
        .optional(),
      periodStart: z.coerce.date().optional(),
      periodEnd: z.coerce.date().optional(),
      cancelAtPeriodEnd: z.boolean().optional(),
      canceledAt: z.coerce.date().optional().nullable(),
      endedAt: z.coerce.date().optional().nullable(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, subscriptionId, ...updateData } = data;
    return updateAdminSubscription(session, db, orgId as OrgId, subscriptionId, updateData);
  });

export const cancelSubscriptionAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string(), subscriptionId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    cancelAdminSubscription(session, db, data.orgId as OrgId, data.subscriptionId),
  );
