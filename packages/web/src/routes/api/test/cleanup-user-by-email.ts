import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { user, member, session, account, verification } from '@corates/db/schema';
import { devModeGate } from '@/server/devModeGate';

export const handler = async ({ request }: { request: Request }) => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    const db = drizzle(env.DB);
    const body = (await request.json()) as { email: string };

    const users = await db.select().from(user).where(eq(user.email, body.email)).all();

    for (const u of users) {
      await db.delete(session).where(eq(session.userId, u.id));
      await db.delete(account).where(eq(account.userId, u.id));
      await db.delete(member).where(eq(member.userId, u.id));
      await db.delete(user).where(eq(user.id, u.id));
    }

    await db.delete(verification).where(eq(verification.identifier, body.email));
    for (const prefix of [
      'test-url:magic-link:',
      'test-url:verification:',
      'test-url:reset-password:',
    ]) {
      await db.delete(verification).where(eq(verification.identifier, `${prefix}${body.email}`));
    }

    return Response.json({ success: true, deletedCount: users.length });
  } catch (err) {
    console.error('[test-seed] Cleanup by email error:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/test/cleanup-user-by-email')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
