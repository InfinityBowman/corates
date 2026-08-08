import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { verification } from '@corates/db/schema';
import { devModeGate } from '@/server/devModeGate';
import { captureError } from '@corates/workers/logger';

export const handler = async ({ request }: { request: Request }) => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    const db = drizzle(env.DB);
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const type = url.searchParams.get('type');

    if (!email || !type) {
      return Response.json({ error: 'email and type query params required' }, { status: 400 });
    }

    const identifier = `test-url:${type}:${email}`;
    const rows = await db
      .select()
      .from(verification)
      .where(eq(verification.identifier, identifier))
      .all();

    if (!rows.length) {
      return Response.json({ error: `No ${type} URL found for ${email}` }, { status: 404 });
    }

    const latest = rows.sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    )[0];

    return Response.json({ success: true, url: latest.value });
  } catch (err) {
    captureError(err, { tags: { component: 'test-routes', action: 'auth-url' } });
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/test/auth-url')({
  server: {
    handlers: {
      GET: handler,
    },
  },
});
