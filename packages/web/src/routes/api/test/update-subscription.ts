import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { subscription } from '@corates/db/schema';
import { devModeGate } from '@/server/devModeGate';
import { captureError } from '@corates/workers/logger';

export const handler = async ({ request }: { request: Request }) => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    const db = drizzle(env.DB);
    const body = (await request.json()) as {
      orgId: string;
      plan?: string;
      status?: string;
      periodEnd?: number;
      cancelAtPeriodEnd?: boolean;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.plan !== undefined) updates.plan = body.plan;
    if (body.status !== undefined) updates.status = body.status;
    if (body.periodEnd !== undefined) updates.periodEnd = new Date(body.periodEnd * 1000);
    if (body.cancelAtPeriodEnd !== undefined) updates.cancelAtPeriodEnd = body.cancelAtPeriodEnd;

    await db.update(subscription).set(updates).where(eq(subscription.referenceId, body.orgId));

    return Response.json({ success: true });
  } catch (err) {
    captureError(err, { tags: { component: 'test-routes', action: 'update-subscription' } });
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/test/update-subscription')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
