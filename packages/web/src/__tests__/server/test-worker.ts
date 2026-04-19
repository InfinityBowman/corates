// Entry point for @cloudflare/vitest-pool-workers.
//
// Re-exports Durable Object classes so wrangler DO bindings resolve against
// this worker. Mounts createStartHandler so tests can use SELF.fetch() to
// exercise the real route -> middleware -> handler chain end-to-end.
//
// The vitest server config aliases the three #tanstack-* virtual modules to
// stand-in files (see vitest.server.config.ts) so createStartHandler can boot
// without the tanstackStart vite plugin running in the test pool.
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';

export { UserSession, ProjectDoc } from '@corates/workers/durable-objects';

const startFetch = createStartHandler(defaultStreamHandler);

export default {
  async fetch(request: Request): Promise<Response> {
    return startFetch(request, { context: {} } as never);
  },
};
