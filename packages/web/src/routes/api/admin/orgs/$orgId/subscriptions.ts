/**
 * Admin: create org subscription
 *
 * POST /api/admin/orgs/:orgId/subscriptions — manually insert a subscription
 * row for an org. Notifies org members of the change (via `cloudflareCtx`'s
 * `waitUntil` when available, otherwise awaited inline).
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { organization, subscription } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS, getPlan } from '@corates/shared';
import { notifyOrgMembers, EventTypes } from '@corates/workers/notify';
import { adminMiddleware } from '@/server/middleware/admin';

const CreateSubscriptionBodySchema = z.object({
  plan: z.enum(['starter_team', 'team', 'unlimited_team']),
  status: z.enum(['active', 'trialing', 'past_due', 'paused', 'canceled', 'unpaid']),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  cancelAtPeriodEnd: z.boolean().optional().default(false),
});

type HandlerArgs = {
  request: Request;
  params: { orgId: string };
};

export const handlePost = async ({ request, params }: HandlerArgs) => {
  const { orgId } = params;
  const db = createDb(env.DB);

  let body: z.infer<typeof CreateSubscriptionBodySchema>;
  try {
    const raw = await request.json();
    body = CreateSubscriptionBodySchema.parse(raw);
  } catch (err) {
    return Response.json(
      createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'body',
        value: (err as Error).message,
      }),
      { status: 400 },
    );
  }

  try {
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      return Response.json(
        createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
          field: 'orgId',
          value: orgId,
        }),
        { status: 400 },
      );
    }

    const plan = getPlan(body.plan);
    if (!plan) {
      return Response.json(
        createDomainError(VALIDATION_ERRORS.INVALID_INPUT, { field: 'plan', value: body.plan }),
        { status: 400 },
      );
    }

    const subscriptionId = crypto.randomUUID();
    const now = new Date();

    const created = await db
      .insert(subscription)
      .values({
        id: subscriptionId,
        plan: body.plan,
        referenceId: orgId,
        status: body.status,
        stripeCustomerId: body.stripeCustomerId || null,
        stripeSubscriptionId: body.stripeSubscriptionId || null,
        periodStart: body.periodStart || now,
        periodEnd: body.periodEnd || null,
        cancelAtPeriodEnd: body.cancelAtPeriodEnd || false,
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

    return Response.json({ success: true, subscription: created }, { status: 201 });
  } catch (err) {
    const error = err as Error;
    console.error('Error creating subscription:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'create_subscription',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

interface NotifyData {
  subscriptionId?: string;
  tier?: string;
  status?: string;
  periodEnd?: Date | number | null;
  cancelAtPeriodEnd?: boolean | number | null;
  endedAt?: Date | number | null;
}

export async function dispatchSubscriptionNotify(
  db: ReturnType<typeof createDb>,
  orgId: string,
  action: string,
  data: NotifyData,
): Promise<void> {
  try {
    const result = await notifyOrgMembers(env, db, orgId, {
      type: EventTypes.SUBSCRIPTION_UPDATED,
      data: data as Record<string, unknown>,
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

export const Route = createFileRoute('/api/admin/orgs/$orgId/subscriptions')({
  server: {
    middleware: [adminMiddleware],
    handlers: { POST: handlePost },
  },
});
