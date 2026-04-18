import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { user } from '@corates/db/schema';
import { devModeGate } from '@/server/devModeGate';

export const handler = async ({ request }: { request: Request }) => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    const db = drizzle(env.DB);
    const body = (await request.json()) as { email: string; completeProfile?: boolean };

    const updates: Record<string, unknown> = {
      emailVerified: true,
      updatedAt: new Date(),
    };
    if (body.completeProfile) {
      updates.profileCompletedAt = Math.floor(Date.now() / 1000);
    }

    await db.update(user).set(updates).where(eq(user.email, body.email));

    return Response.json({ success: true });
  } catch (err) {
    console.error('[test-seed] Verify email error:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/test/verify-email')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
