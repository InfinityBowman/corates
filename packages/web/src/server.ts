import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { workerHandler } from '@corates/workers';

// Re-export DOs so wrangler DO bindings in wrangler.jsonc resolve against this
// worker's main module. The class implementations live in @corates/workers.
export { UserSession, ProjectDoc } from '@corates/workers';

const startFetch = createStartHandler(defaultStreamHandler);

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    // WebSocket upgrades must be handled before TanStack Start (which can't pass
    // them through). The Hono app in @corates/workers already routes
    // /api/project-doc/* and /api/sessions/* to the DOs.
    const upgrade = request.headers.get('upgrade')?.toLowerCase();
    if (upgrade === 'websocket') {
      return workerHandler.fetch(request, env as never, ctx);
    }
    return startFetch(request);
  },

  async queue(batch: MessageBatch<unknown>, env: unknown): Promise<void> {
    return workerHandler.queue(batch, env as never);
  },
};
