import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq } from 'drizzle-orm';
import { verification } from '@corates/db/schema';
import { devModeGate } from '@/server/devModeGate';
import { captureError } from '@corates/workers/logger';

// Pending codes are stored plain as `<code>:<attempts>` under `<type>-otp-<email>`
export const handler = async ({ request }: { request: Request }) => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    const db = drizzle(env.DB);
    const url = new URL(request.url);
    const email = url.searchParams.get('email')?.toLowerCase();
    const type = url.searchParams.get('type');
    if (!email || !type) {
      return Response.json({ error: 'email and type query params required' }, { status: 400 });
    }

    // Every send adds a row; Better Auth verifies against the newest
    const row = await db
      .select()
      .from(verification)
      .where(eq(verification.identifier, `${type}-otp-${email}`))
      .orderBy(desc(verification.createdAt))
      .limit(1)
      .get();
    if (!row) {
      return Response.json({ error: `No ${type} code found for ${email}` }, { status: 404 });
    }

    const code = row.value.slice(0, row.value.lastIndexOf(':'));
    return Response.json({ success: true, code });
  } catch (err) {
    captureError(err, { tags: { component: 'test-routes', action: 'auth-code' } });
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/test/auth-code')({
  server: {
    handlers: {
      GET: handler,
    },
  },
});
