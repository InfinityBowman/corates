/**
 * Admin: update + cancel a single subscription
 *
 * PUT /api/admin/orgs/:orgId/subscriptions/:subscriptionId — patch any of the
 * subscription fields (only the keys present in the body are updated).
 * DELETE — soft-cancel by setting status='canceled' and endedAt=now.
 * Both notify org members of the change.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { subscription } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';
import { dispatchSubscriptionNotify } from '../subscriptions';

const UpdateSubscriptionBodySchema = z.object({
  plan: z.enum(['starter_team', 'team', 'unlimited_team']).optional(),
  status: z
    .enum(['active', 'trialing', 'past_due', 'paused', 'canceled', 'unpaid', 'incomplete'])
    .optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  canceledAt: z.coerce.date().optional().nullable(),
  endedAt: z.coerce.date().optional().nullable(),
});

type HandlerArgs = {
  request: Request;
  params: { orgId: string; subscriptionId: string };
  context?: { cloudflareCtx?: ExecutionContext };
};

export const handlePut = async ({ request, params, context }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { orgId, subscriptionId } = params;
  const db = createDb(env.DB);

  let body: z.infer<typeof UpdateSubscriptionBodySchema>;
  try {
    const raw = await request.json();
    body = UpdateSubscriptionBodySchema.parse(raw);
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
    const existing = await db
      .select()
      .from(subscription)
      .where(and(eq(subscription.id, subscriptionId), eq(subscription.referenceId, orgId)))
      .get();
    if (!existing) {
      return Response.json(
        createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
          field: 'subscriptionId',
          value: subscriptionId,
        }),
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.plan !== undefined) updateData.plan = body.plan;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.periodStart !== undefined) updateData.periodStart = body.periodStart;
    if (body.periodEnd !== undefined) updateData.periodEnd = body.periodEnd;
    if (body.cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = body.cancelAtPeriodEnd;
    if (body.canceledAt !== undefined) updateData.canceledAt = body.canceledAt;
    if (body.endedAt !== undefined) updateData.endedAt = body.endedAt;

    const updated = await db
      .update(subscription)
      .set(updateData)
      .where(eq(subscription.id, subscriptionId))
      .returning()
      .get();

    await dispatchSubscriptionNotify(context, db, orgId, 'update', {
      subscriptionId: updated.id,
      tier: updated.plan,
      status: updated.status,
      periodEnd: updated.periodEnd,
      cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
    });

    return Response.json({ success: true, subscription: updated }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error updating subscription:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_subscription',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handleDelete = async ({ request, params, context }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { orgId, subscriptionId } = params;
  const db = createDb(env.DB);

  try {
    const existing = await db
      .select()
      .from(subscription)
      .where(and(eq(subscription.id, subscriptionId), eq(subscription.referenceId, orgId)))
      .get();
    if (!existing) {
      return Response.json(
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

    await dispatchSubscriptionNotify(context, db, orgId, 'cancellation', {
      subscriptionId,
      tier: canceled.plan,
      status: 'canceled',
      periodEnd: canceled.periodEnd,
      endedAt: canceled.endedAt,
    });

    return Response.json({ success: true, message: 'Subscription canceled' }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error canceling subscription:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'cancel_subscription',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/orgs/$orgId/subscriptions/$subscriptionId')({
  server: { handlers: { PUT: handlePut, DELETE: handleDelete } },
});
