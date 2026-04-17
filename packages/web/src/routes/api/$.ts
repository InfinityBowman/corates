import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { app as honoApp } from '@corates/workers';

// Catch-all mount: all /api/* requests flow into the Hono app from @corates/workers.
// This lets us consolidate onto one worker without rewriting 66 routes. WebSocket
// upgrades are intercepted earlier in src/server.ts and don't reach this handler.
const handle = ({ request }: { request: Request }) => honoApp.fetch(request, env);

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
