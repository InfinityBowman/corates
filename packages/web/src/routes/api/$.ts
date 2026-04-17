import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { app as honoApp } from '@corates/workers';

// Catch-all mount: all /api/* requests flow into the Hono app from @corates/workers.
// This lets us consolidate onto one worker without rewriting 66 routes. WebSocket
// upgrades are intercepted earlier in src/server.ts and don't reach this handler.
// cloudflareCtx is injected by src/server.ts so Hono's c.executionCtx resolves.
const handle = ({
  request,
  context,
}: {
  request: Request;
  context?: { cloudflareCtx?: ExecutionContext };
}) => honoApp.fetch(request, env, context?.cloudflareCtx);

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
      OPTIONS: handle,
    },
  },
});
