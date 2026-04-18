import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { handleEmailQueue } from '@corates/workers/queue';
import { getProjectDocStub } from '@corates/workers/project-doc-id';

// Re-export DOs so wrangler DO bindings in wrangler.jsonc resolve against this
// worker's main module. The class implementations live in @corates/workers.
export { UserSession, ProjectDoc } from '@corates/workers/durable-objects';

const startFetch = createStartHandler(defaultStreamHandler);

// `/api/project-doc/<projectId>(/<...>)?` — y-websocket appends the room as
// the trailing segment; we route by path prefix and forward the original
// Request (including upgrade headers) to the project-scoped DO.
const PROJECT_DOC_PATH = /^\/api\/project-doc\/([^/]+)(?:\/.*)?$/;

// `/api/sessions/<sessionId>(/<...>)?` — UserSession DO for per-user
// notification fan-out. WebSocket upgrades only.
const SESSION_PATH = /^\/api\/sessions\/([^/]+)(?:\/.*)?$/;

interface DOEnv {
  USER_SESSION: { idFromName(name: string): unknown; get(id: unknown): { fetch(req: Request): Promise<Response> } };
}

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // DO routes must be handled before TanStack Start (which can't pass
    // WebSocket upgrades through). Same Request is forwarded as-is so the
    // upgrade handshake reaches the DO.
    const projectMatch = url.pathname.match(PROJECT_DOC_PATH);
    if (projectMatch) {
      const projectId = projectMatch[1];
      const stub = getProjectDocStub(env as never, projectId);
      return stub.fetch(request);
    }

    const sessionMatch = url.pathname.match(SESSION_PATH);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      const ns = (env as DOEnv).USER_SESSION;
      const id = ns.idFromName(sessionId);
      const stub = ns.get(id);
      return stub.fetch(request);
    }

    // Forward the Worker's ExecutionContext through TanStack Start so file
    // routes can pass it into route handlers (waitUntil for fire-and-forget
    // work like Stripe webhook ledger updates and notification fan-out).
    // Cast: createStartHandler's RequestOptions.context defaults to a narrow
    // BaseContext until we register a project-wide requestContext type.
    return startFetch(request, { context: { cloudflareCtx: ctx } } as never);
  },

  async queue(batch: MessageBatch<unknown>, env: unknown): Promise<void> {
    return handleEmailQueue(batch, env as never);
  },
};
