import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { user, organization, member, session, subscription } from '@corates/db/schema';
import { devModeGate } from '@/server/devModeGate';

export const handler = async ({ request }: { request: Request }) => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    const db = drizzle(env.DB);
    const body = (await request.json()) as {
      userIds?: string[];
      orgId?: string;
    };

    if (body.userIds) {
      for (const userId of body.userIds) {
        await db.delete(session).where(eq(session.userId, userId));
        await db.delete(member).where(eq(member.userId, userId));
        await db.delete(user).where(eq(user.id, userId));
      }
    }

    if (body.orgId) {
      await db.delete(subscription).where(eq(subscription.referenceId, body.orgId));
      await db.delete(member).where(eq(member.organizationId, body.orgId));
      await db.delete(organization).where(eq(organization.id, body.orgId));
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[test-seed] Cleanup error:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/test/cleanup')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
