/**
 * Library-only entry for `@cloudflare/vitest-pool-workers`. Re-exports the
 * Durable Object classes so wrangler DO bindings resolve; tests import their
 * subjects (commands, lib helpers, DO classes) directly — there is no real
 * fetch handler to wire.
 */
export { UserSession, ProjectDoc } from './durable-objects';

export default {
  async fetch(): Promise<Response> {
    return new Response('test-worker: not a real app; tests call helpers directly', {
      status: 404,
    });
  },
};
