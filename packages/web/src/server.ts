import * as Sentry from '@sentry/cloudflare';
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { handleEmailQueue } from '@corates/workers/queue';
import { runWithLogger } from '@corates/workers/logger';
import { handleSyncFetch } from '@corates/workers/sync';

// Re-export DOs so wrangler DO bindings in wrangler.jsonc resolve against this
// worker's main module. The class implementations live in @corates/workers.
export { UserSession, WorkspaceDO } from '@corates/workers/durable-objects';

const startFetch = createStartHandler(defaultStreamHandler);

// `/api/sessions/<sessionId>(/<...>)?` — UserSession DO for per-user
// notification fan-out. WebSocket upgrades only.
const SESSION_PATH = /^\/api\/sessions\/([^/]+)(?:\/.*)?$/;

interface DOEnv {
  USER_SESSION: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(req: Request): Promise<Response> };
  };
}

interface SentryEnv {
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
  CF_VERSION_METADATA?: { id?: string };
}

const workerHandler = {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Scope every log emitted while handling this request to one requestId.
    // An inbound x-request-id wins so a caller's id survives across hops.
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();

    return runWithLogger(
      {
        requestId,
        cfRay: request.headers.get('cf-ray'),
        env: (env as SentryEnv).ENVIRONMENT,
        context: { route: url.pathname, method: request.method },
      },
      async () => {
        // DO routes must be handled before TanStack Start (which can't pass
        // WebSocket upgrades through).
        const sessionMatch = url.pathname.match(SESSION_PATH);
        if (sessionMatch) {
          const sessionId = sessionMatch[1];
          const ns = (env as DOEnv).USER_SESSION;
          const id = ns.idFromName(sessionId);
          const stub = ns.get(id);
          // AsyncLocalStorage does not cross the isolate boundary, so the id
          // rides as a header instead and the DO reopens its own scope.
          // Rebuilding the Request preserves the upgrade handshake (covered by
          // durable-objects/__tests__/do-correlation).
          const headers = new Headers(request.headers);
          headers.set('x-request-id', requestId);
          return stub.fetch(new Request(request, { headers }));
        }

        // Sync-engine routes (`/api/sync/<projectId>` upgrades and
        // `/api/sync-admin/...`): resolves null for anything else.
        const syncResponse = await handleSyncFetch(request, env);
        if (syncResponse) return syncResponse;

        // Forward the Worker's ExecutionContext through TanStack Start so file
        // routes can pass it into route handlers (waitUntil for fire-and-forget
        // work like Stripe webhook ledger updates and notification fan-out).
        // Cast: createStartHandler's RequestOptions.context defaults to a narrow
        // BaseContext until we register a project-wide requestContext type.
        return startFetch(request, { context: { cloudflareCtx: ctx } } as never);
      },
    );
  },

  async queue(batch: MessageBatch<unknown>, env: unknown): Promise<void> {
    return runWithLogger(
      {
        requestId: crypto.randomUUID(),
        env: (env as SentryEnv).ENVIRONMENT,
        context: { queue: 'email', batchSize: batch.messages.length },
      },
      () => handleEmailQueue(batch, env as never),
    );
  },
};

// Wrap with Sentry for error monitoring. `Sentry.withSentry` proxies fetch +
// queue and uses `ctx.waitUntil` for transport — that's available in the
// production Worker runtime but not in the vitest pool, so the test entry
// (`src/__tests__/server/test-worker.ts`) bypasses this wrapper entirely by
// being a separate `main` in `wrangler.test.jsonc`.
export default Sentry.withSentry((env: SentryEnv) => {
  return {
    dsn: env.SENTRY_DSN ?? '',
    release: env.CF_VERSION_METADATA?.id,
    environment: env.ENVIRONMENT,
    enabled: !!env.SENTRY_DSN,
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.1 : 1.0,
    sendDefaultPii: true,
  };
}, workerHandler);
