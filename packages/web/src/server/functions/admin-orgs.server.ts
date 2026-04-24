import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { organization, member, projects, subscription, orgAccessGrants } from '@corates/db/schema';
import { and, count, desc, eq, like, or, sql } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  AUTH_ERRORS,
  VALIDATION_ERRORS,
  getPlan,
  getGrantPlan,
  type GrantType,
} from '@corates/shared';
import type { OrgId, OrgAccessGrantId } from '@corates/shared/ids';
import { isAdminUser } from '@corates/workers/auth-admin';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import {
  createGrant,
  getGrantById,
  getGrantByOrgIdAndType,
  getGrantsByOrgId,
  revokeGrant,
  updateGrantExpiresAt,
} from '@corates/db/org-access-grants';
import { getLedgerEntriesByOrgId, LedgerStatus } from '@corates/db/stripe-event-ledger';
import { createStripeClient } from '@corates/workers/stripe';
import { notifyOrgMembers, EventTypes } from '@corates/workers/notify';
import type { Session } from '@/server/middleware/auth';

function assertAdmin(session: Session) {
  if (!isAdminUser(session.user as { role?: string | null })) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' }),
      { status: 403 },
    );
  }
}

interface StuckState {
  type: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  subscriptionId?: string;
  stripeSubscriptionId?: string | null;
  status?: string;
  ageMinutes?: number;
  threshold?: number;
  description?: string;
  ledgerId?: string;
  stripeEventId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  failedCount?: number;
  recentFailures?: { ledgerId: string; stripeEventId: string | null; type: string | null; error: string | null; receivedAt: Date }[];
  lagMinutes?: number;
  payloadHash?: string;
  periodEnd?: number;
  localStatus?: string;
  stripeStatus?: string;
}

async function dispatchSubscriptionNotify(
  db: Database,
  orgId: string,
  action: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const result = await notifyOrgMembers(env, db, orgId, {
      type: EventTypes.SUBSCRIPTION_UPDATED,
      data,
    });
    console.log(`[Admin] Subscription ${action} notification sent:`, {
      orgId,
      subscriptionId: data.subscriptionId || data.tier,
      notified: result.notified,
      failed: result.failed,
    });
  } catch (err) {
    const error = err as Error;
    console.error(`[Admin] Subscription ${action} notification error:`, {
      orgId,
      error: error.message,
    });
  }
}

export async function listAdminOrgs(
  session: Session,
  db: Database,
  params: { page?: number; limit?: number; search?: string },
) {
  assertAdmin(session);

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const search = params.search?.trim() || undefined;
  const offset = (page - 1) * limit;

  const searchCondition =
    search ?
      or(
        like(sql`LOWER(${organization.name})`, `%${search.toLowerCase()}%`),
        like(sql`LOWER(${organization.slug})`, `%${search.toLowerCase()}%`),
      )
    : undefined;

  const totalCountQuery =
    searchCondition ?
      db.select({ count: count() }).from(organization).where(searchCondition)
    : db.select({ count: count() }).from(organization);

  const [totalResult] = await totalCountQuery.all();
  const total = totalResult?.count || 0;

  const baseQuery = db.select().from(organization);
  const orgs = await (searchCondition ? baseQuery.where(searchCondition) : baseQuery)
    .orderBy(desc(organization.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const orgIds = orgs.map(o => o.id);
  const statsMap: Record<string, { memberCount?: number; projectCount?: number }> = {};

  if (orgIds.length > 0) {
    const memberCounts = await db
      .select({ organizationId: member.organizationId, count: count() })
      .from(member)
      .where(
        sql`${member.organizationId} IN (${sql.join(
          orgIds.map(id => sql`${id}`),
          sql`, `,
        )})`,
      )
      .groupBy(member.organizationId)
      .all();

    const projectCounts = await db
      .select({ orgId: projects.orgId, count: count() })
      .from(projects)
      .where(
        sql`${projects.orgId} IN (${sql.join(
          orgIds.map(id => sql`${id}`),
          sql`, `,
        )})`,
      )
      .groupBy(projects.orgId)
      .all();

    memberCounts.forEach(({ organizationId, count: cnt }) => {
      if (!statsMap[organizationId]) statsMap[organizationId] = {};
      statsMap[organizationId].memberCount = cnt;
    });

    projectCounts.forEach(({ orgId, count: cnt }) => {
      if (!statsMap[orgId]) statsMap[orgId] = {};
      statsMap[orgId].projectCount = cnt;
    });
  }

  return {
    orgs: orgs.map(o => ({
      ...o,
      stats: {
        memberCount: statsMap[o.id]?.memberCount || 0,
        projectCount: statsMap[o.id]?.projectCount || 0,
      },
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getAdminOrgDetails(session: Session, db: Database, orgId: OrgId) {
  assertAdmin(session);

  const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
  if (!org) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_not_found', orgId }),
      { status: 403 },
    );
  }

  const [memberCountResult] = await db
    .select({ count: count() })
    .from(member)
    .where(eq(member.organizationId, orgId))
    .all();
  const memberCount = memberCountResult?.count || 0;

  const [projectCountResult] = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.orgId, orgId))
    .all();
  const projectCount = projectCountResult?.count || 0;

  const orgBilling = await resolveOrgAccess(db, orgId);
  const effectivePlan =
    orgBilling.source === 'grant' ?
      getGrantPlan(orgBilling.effectivePlanId as GrantType)
    : getPlan(orgBilling.effectivePlanId);

  return {
    org,
    stats: { memberCount, projectCount },
    billing: {
      effectivePlanId: orgBilling.effectivePlanId,
      source: orgBilling.source,
      accessMode: orgBilling.accessMode,
      plan: {
        name: effectivePlan.name,
        entitlements: effectivePlan.entitlements,
        quotas: effectivePlan.quotas,
      },
      subscription: orgBilling.subscription,
      grant: orgBilling.grant,
    },
  };
}

export async function getAdminOrgBilling(session: Session, db: Database, orgId: OrgId) {
  assertAdmin(session);

  const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
  if (!org) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      }),
      { status: 400 },
    );
  }

  const orgBilling = await resolveOrgAccess(db, orgId);

  const allSubscriptions = await db
    .select()
    .from(subscription)
    .where(eq(subscription.referenceId, orgId))
    .orderBy(desc(subscription.createdAt))
    .all();

  const allGrants = await getGrantsByOrgId(db, orgId);

  const effectivePlan =
    orgBilling.source === 'grant' ?
      getGrantPlan(orgBilling.effectivePlanId as GrantType)
    : getPlan(orgBilling.effectivePlanId);

  return {
    orgId,
    orgName: org.name,
    orgSlug: org.slug,
    billing: {
      effectivePlanId: orgBilling.effectivePlanId,
      source: orgBilling.source,
      accessMode: orgBilling.accessMode,
      plan: {
        name: effectivePlan.name,
        entitlements: effectivePlan.entitlements,
        quotas: effectivePlan.quotas,
      },
      subscription: orgBilling.subscription,
      grant: orgBilling.grant,
    },
    subscriptions: allSubscriptions,
    grants: allGrants,
  };
}

export async function reconcileAdminOrgBilling(
  session: Session,
  db: Database,
  orgId: OrgId,
  params: {
    checkStripe?: boolean;
    incompleteThreshold?: number;
    checkoutNoSubThreshold?: number;
    processingLagThreshold?: number;
  },
) {
  assertAdmin(session);

  const checkStripe = params.checkStripe ?? false;
  const incompleteThresholdMinutes = params.incompleteThreshold ?? 30;
  const checkoutNoSubThresholdMinutes = params.checkoutNoSubThreshold ?? 15;
  const processingLagThresholdMinutes = params.processingLagThreshold ?? 5;

  const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
  if (!org) {
    throw Response.json(
      createValidationError('orgId', VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code, orgId),
      { status: 400 },
    );
  }

  const stuckStates: StuckState[] = [];
  const now = new Date();
  const nowTimestamp = Math.floor(now.getTime() / 1000);

  const allSubscriptions = await db
    .select()
    .from(subscription)
    .where(eq(subscription.referenceId, orgId))
    .orderBy(desc(subscription.createdAt))
    .all();

  for (const sub of allSubscriptions) {
    if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') {
      if (!sub.createdAt) continue;
      const createdAtTimestamp =
        sub.createdAt instanceof Date ?
          Math.floor(sub.createdAt.getTime() / 1000)
        : sub.createdAt;
      const ageMinutes = (nowTimestamp - createdAtTimestamp) / 60;

      if (ageMinutes > incompleteThresholdMinutes) {
        stuckStates.push({
          type: 'incomplete_subscription',
          severity: 'high',
          subscriptionId: sub.id,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          status: sub.status,
          ageMinutes: Math.round(ageMinutes),
          threshold: incompleteThresholdMinutes,
          description: `Subscription has been in ${sub.status} status for ${Math.round(ageMinutes)} minutes (threshold: ${incompleteThresholdMinutes})`,
        });
      }
    }

    if (sub.status === 'past_due') {
      const periodEnd =
        sub.periodEnd instanceof Date ?
          Math.floor(sub.periodEnd.getTime() / 1000)
        : (sub.periodEnd as number | null);
      if (periodEnd && nowTimestamp > periodEnd) {
        stuckStates.push({
          type: 'past_due_expired',
          severity: 'high',
          subscriptionId: sub.id,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          status: sub.status,
          periodEnd,
          description: `Subscription is past_due and period has ended`,
        });
      }
    }
  }

  const ledgerEntries = await getLedgerEntriesByOrgId(db, orgId, { limit: 100 });

  const checkoutCompletedEvents = ledgerEntries.filter(
    entry =>
      entry.type === 'checkout.session.completed' && entry.status === LedgerStatus.PROCESSED,
  );

  for (const event of checkoutCompletedEvents) {
    const processedAtTimestamp =
      event.processedAt instanceof Date ?
        Math.floor(event.processedAt.getTime() / 1000)
      : (event.processedAt as number | null);
    if (!processedAtTimestamp) continue;
    const ageMinutes = (nowTimestamp - processedAtTimestamp) / 60;

    if (ageMinutes > checkoutNoSubThresholdMinutes) {
      const matchingSub = allSubscriptions.find(
        sub =>
          sub.stripeCustomerId === event.stripeCustomerId ||
          sub.stripeSubscriptionId === event.stripeSubscriptionId,
      );

      if (!matchingSub) {
        stuckStates.push({
          type: 'checkout_no_subscription',
          severity: 'critical',
          ledgerId: event.id,
          stripeEventId: event.stripeEventId,
          stripeCheckoutSessionId: event.stripeCheckoutSessionId,
          stripeCustomerId: event.stripeCustomerId,
          ageMinutes: Math.round(ageMinutes),
          threshold: checkoutNoSubThresholdMinutes,
          description: `checkout.session.completed event processed ${Math.round(ageMinutes)} minutes ago but no subscription row exists. Common causes: plugin misconfig, referenceId mismatch, authorization failure.`,
        });
      }
    }
  }

  const failedEvents = ledgerEntries.filter(entry => entry.status === LedgerStatus.FAILED);
  if (failedEvents.length >= 3) {
    stuckStates.push({
      type: 'repeated_webhook_failures',
      severity: 'medium',
      failedCount: failedEvents.length,
      recentFailures: failedEvents.slice(0, 5).map(e => ({
        ledgerId: e.id,
        stripeEventId: e.stripeEventId,
        type: e.type,
        error: e.error,
        receivedAt: e.receivedAt,
      })),
      description: `${failedEvents.length} webhook failures recorded for this org`,
    });
  }

  const receivedEvents = ledgerEntries.filter(
    entry => entry.status === LedgerStatus.RECEIVED && entry.processedAt === null,
  );

  for (const event of receivedEvents) {
    const receivedAtTimestamp =
      event.receivedAt instanceof Date ?
        Math.floor(event.receivedAt.getTime() / 1000)
      : (event.receivedAt as number);
    const lagMinutes = (nowTimestamp - receivedAtTimestamp) / 60;

    if (lagMinutes > processingLagThresholdMinutes) {
      stuckStates.push({
        type: 'processing_lag',
        severity: 'medium',
        ledgerId: event.id,
        payloadHash: event.payloadHash,
        lagMinutes: Math.round(lagMinutes),
        threshold: processingLagThresholdMinutes,
        description: `Webhook received ${Math.round(lagMinutes)} minutes ago but not yet processed`,
      });
    }
  }

  const ignoredEvents = ledgerEntries.filter(
    entry => entry.status === LedgerStatus.IGNORED_UNVERIFIED,
  );

  let stripeComparison: Record<string, string | boolean | null> | null = null;
  if (checkStripe && env.STRIPE_SECRET_KEY) {
    try {
      const stripe = createStripeClient(env);
      const activeSubscription = allSubscriptions.find(
        sub => sub.status === 'active' || sub.status === 'trialing',
      );

      if (activeSubscription?.stripeSubscriptionId) {
        const stripeSub = await stripe.subscriptions.retrieve(
          activeSubscription.stripeSubscriptionId,
        );
        const localStatus = activeSubscription.status;
        const stripeStatus = stripeSub.status;

        if (localStatus !== stripeStatus) {
          stuckStates.push({
            type: 'stripe_status_mismatch',
            severity: 'high',
            subscriptionId: activeSubscription.id,
            stripeSubscriptionId: activeSubscription.stripeSubscriptionId,
            localStatus,
            stripeStatus,
            description: `Local subscription status (${localStatus}) does not match Stripe status (${stripeStatus})`,
          });
        }

        stripeComparison = {
          checked: true,
          stripeSubscriptionId: activeSubscription.stripeSubscriptionId,
          localStatus,
          stripeStatus,
          match: localStatus === stripeStatus,
        };
      } else {
        stripeComparison = { checked: true, noActiveSubscription: true };
      }
    } catch (stripeErr) {
      const stripeError = stripeErr as Error;
      stripeComparison = { checked: true, error: stripeError.message };
    }
  }

  return {
    orgId,
    orgName: org.name,
    reconcileAt: now.toISOString(),
    thresholds: {
      incompleteMinutes: incompleteThresholdMinutes,
      checkoutNoSubMinutes: checkoutNoSubThresholdMinutes,
      processingLagMinutes: processingLagThresholdMinutes,
    },
    summary: {
      totalSubscriptions: allSubscriptions.length,
      totalLedgerEntries: ledgerEntries.length,
      failedWebhooks: failedEvents.length,
      ignoredWebhooks: ignoredEvents.length,
      stuckStateCount: stuckStates.length,
      hasCriticalIssues: stuckStates.some(s => s.severity === 'critical'),
      hasHighIssues: stuckStates.some(s => s.severity === 'high'),
    },
    stuckStates,
    stripeComparison,
  };
}

export async function createAdminGrant(
  session: Session,
  db: Database,
  orgId: OrgId,
  data: {
    type: 'trial' | 'single_project';
    startsAt: Date;
    expiresAt: Date;
    metadata?: Record<string, unknown>;
  },
) {
  assertAdmin(session);

  const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
  if (!org) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      }),
      { status: 400 },
    );
  }

  if (data.type === 'trial') {
    const existingTrial = await getGrantByOrgIdAndType(db, orgId, 'trial');
    if (existingTrial) {
      throw Response.json(
        createDomainError(
          VALIDATION_ERRORS.INVALID_INPUT,
          { field: 'type', value: 'trial' },
          'Trial grant already exists for this organization. Each organization can only have one trial grant.',
        ),
        { status: 400 },
      );
    }
  }

  if (data.expiresAt <= data.startsAt) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'expiresAt',
        value: 'expiresAt must be after startsAt',
      }),
      { status: 400 },
    );
  }

  const grantId = crypto.randomUUID() as OrgAccessGrantId;
  const created = await createGrant(db, {
    id: grantId,
    orgId,
    type: data.type,
    startsAt: data.startsAt,
    expiresAt: data.expiresAt,
    metadata: data.metadata || null,
  });

  return { success: true, grant: created };
}

export async function updateAdminGrant(
  session: Session,
  db: Database,
  orgId: OrgId,
  grantId: OrgAccessGrantId,
  data: { expiresAt?: Date; revokedAt?: Date | null },
) {
  assertAdmin(session);

  const existing = await getGrantById(db, grantId);
  if (!existing || existing.orgId !== orgId) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'grantId',
        value: grantId,
      }),
      { status: 400 },
    );
  }

  if (data.expiresAt !== undefined) {
    const updated = await updateGrantExpiresAt(db, grantId, data.expiresAt);
    return { success: true, grant: updated };
  }

  if (data.revokedAt !== undefined) {
    if (data.revokedAt === null) {
      const result = (await db
        .update(orgAccessGrants)
        .set({ revokedAt: null })
        .where(eq(orgAccessGrants.id, grantId))
        .returning()
        .get())!;
      return { success: true, grant: result };
    }
    const revoked = await revokeGrant(db, grantId);
    return { success: true, grant: revoked };
  }

  throw Response.json(
    createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
      field: 'body',
      value: 'At least one field (expiresAt or revokedAt) must be provided',
    }),
    { status: 400 },
  );
}

export async function revokeAdminGrant(
  session: Session,
  db: Database,
  orgId: OrgId,
  grantId: OrgAccessGrantId,
) {
  assertAdmin(session);

  const existing = await getGrantById(db, grantId);
  if (!existing || existing.orgId !== orgId) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'grantId',
        value: grantId,
      }),
      { status: 400 },
    );
  }

  await revokeGrant(db, grantId);
  return { success: true, message: 'Grant revoked' };
}

export async function grantAdminTrial(session: Session, db: Database, orgId: OrgId) {
  assertAdmin(session);

  const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
  if (!org) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      }),
      { status: 400 },
    );
  }

  const existingTrial = await getGrantByOrgIdAndType(db, orgId, 'trial');
  if (existingTrial) {
    throw Response.json(
      createDomainError(
        VALIDATION_ERRORS.INVALID_INPUT,
        { field: 'trial', value: 'already_exists' },
        'Trial grant already exists for this organization.',
      ),
      { status: 400 },
    );
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 14);

  const grantId = crypto.randomUUID() as OrgAccessGrantId;
  const created = await createGrant(db, {
    id: grantId,
    orgId,
    type: 'trial',
    startsAt: now,
    expiresAt,
    metadata: { createdBy: 'admin' },
  });

  return { success: true, grant: created };
}

export async function grantAdminSingleProject(session: Session, db: Database, orgId: OrgId) {
  assertAdmin(session);

  const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
  if (!org) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      }),
      { status: 400 },
    );
  }

  const existing = await getGrantByOrgIdAndType(db, orgId, 'single_project');
  const now = new Date();

  if (existing && !existing.revokedAt) {
    const existingExpiresAtTimestamp =
      existing.expiresAt instanceof Date ?
        Math.floor(existing.expiresAt.getTime() / 1000)
      : (existing.expiresAt as number);
    const nowTimestamp = Math.floor(now.getTime() / 1000);
    const baseExpiresAt = Math.max(nowTimestamp, existingExpiresAtTimestamp);
    const newExpiresAt = new Date(baseExpiresAt * 1000);
    newExpiresAt.setMonth(newExpiresAt.getMonth() + 6);

    const updated = (await updateGrantExpiresAt(db, existing.id, newExpiresAt))!;
    return { success: true, grant: updated, action: 'extended' as const };
  }

  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 6);

  const grantId = crypto.randomUUID() as OrgAccessGrantId;
  const created = (await createGrant(db, {
    id: grantId,
    orgId,
    type: 'single_project',
    startsAt: now,
    expiresAt,
    metadata: { createdBy: 'admin' },
  }))!;

  return { success: true, grant: created, action: 'created' as const };
}

export async function createAdminSubscription(
  session: Session,
  db: Database,
  orgId: OrgId,
  data: {
    plan: string;
    status: string;
    periodStart?: Date;
    periodEnd?: Date;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    cancelAtPeriodEnd?: boolean;
  },
) {
  assertAdmin(session);

  const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
  if (!org) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      }),
      { status: 400 },
    );
  }

  const subscriptionId = crypto.randomUUID();
  const now = new Date();

  const created = await db
    .insert(subscription)
    .values({
      id: subscriptionId,
      plan: data.plan,
      referenceId: orgId,
      status: data.status,
      stripeCustomerId: data.stripeCustomerId || null,
      stripeSubscriptionId: data.stripeSubscriptionId || null,
      periodStart: data.periodStart || now,
      periodEnd: data.periodEnd || null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  await dispatchSubscriptionNotify(db, orgId, 'creation', {
    subscriptionId: created.id,
    tier: created.plan,
    status: created.status,
    periodEnd: created.periodEnd,
  });

  return { success: true, subscription: created };
}

export async function updateAdminSubscription(
  session: Session,
  db: Database,
  orgId: OrgId,
  subscriptionId: string,
  data: {
    plan?: string;
    status?: string;
    periodStart?: Date;
    periodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date | null;
    endedAt?: Date | null;
  },
) {
  assertAdmin(session);

  const existing = await db
    .select()
    .from(subscription)
    .where(and(eq(subscription.id, subscriptionId), eq(subscription.referenceId, orgId)))
    .get();
  if (!existing) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'subscriptionId',
        value: subscriptionId,
      }),
      { status: 400 },
    );
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.plan !== undefined) updateData.plan = data.plan;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.periodStart !== undefined) updateData.periodStart = data.periodStart;
  if (data.periodEnd !== undefined) updateData.periodEnd = data.periodEnd;
  if (data.cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = data.cancelAtPeriodEnd;
  if (data.canceledAt !== undefined) updateData.canceledAt = data.canceledAt;
  if (data.endedAt !== undefined) updateData.endedAt = data.endedAt;

  const updated = await db
    .update(subscription)
    .set(updateData)
    .where(eq(subscription.id, subscriptionId))
    .returning()
    .get();

  await dispatchSubscriptionNotify(db, orgId, 'update', {
    subscriptionId: updated.id,
    tier: updated.plan,
    status: updated.status,
    periodEnd: updated.periodEnd,
    cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
  });

  return { success: true, subscription: updated };
}

export async function cancelAdminSubscription(
  session: Session,
  db: Database,
  orgId: OrgId,
  subscriptionId: string,
) {
  assertAdmin(session);

  const existing = await db
    .select()
    .from(subscription)
    .where(and(eq(subscription.id, subscriptionId), eq(subscription.referenceId, orgId)))
    .get();
  if (!existing) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'subscriptionId',
        value: subscriptionId,
      }),
      { status: 400 },
    );
  }

  const now = new Date();
  const canceled = await db
    .update(subscription)
    .set({ status: 'canceled', endedAt: now, updatedAt: now })
    .where(eq(subscription.id, subscriptionId))
    .returning()
    .get();

  await dispatchSubscriptionNotify(db, orgId, 'cancellation', {
    subscriptionId,
    tier: canceled.plan,
    status: 'canceled',
    periodEnd: canceled.periodEnd,
    endedAt: canceled.endedAt,
  });

  return { success: true, message: 'Subscription canceled' };
}
