// Entry point for @cloudflare/vitest-pool-workers. Re-exports Durable Object
// classes so wrangler DO bindings resolve against this worker — tests import
// route handlers directly, so there's no default fetch handler to wire.
export { UserSession, ProjectDoc } from '@corates/workers/durable-objects';

export default {
  async fetch(): Promise<Response> {
    return new Response('test-worker: not a real app; tests call handlers directly', {
      status: 404,
    });
  },
};
