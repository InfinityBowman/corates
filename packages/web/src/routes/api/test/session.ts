import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import { devModeGate } from '@/server/devModeGate';

export const handler = async ({ request }: { request: Request }) => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    const auth = createAuth(env);
    const ctx = await auth.$context;
    const test = (ctx as unknown as { test?: { login: (args: { userId: string }) => Promise<{ token: string; cookies: unknown }> } }).test;

    if (!test) {
      return Response.json({ error: 'testUtils plugin not available' }, { status: 500 });
    }

    const body = (await request.json()) as { userId: string };
    const result = await test.login({ userId: body.userId });

    return Response.json({
      success: true,
      token: result.token,
      cookies: result.cookies,
    });
  } catch (err) {
    console.error('[test-seed] Session error:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/test/session')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
