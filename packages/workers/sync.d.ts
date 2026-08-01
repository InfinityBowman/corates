// Public type surface for @corates/workers/sync.
//
// Hand-maintained stub mirroring the runtime exports from src/sync/index.ts.
// Same firewall pattern as durable-objects.d.ts — keeps @cf-sync/server's
// Cloudflare runtime types out of consumers' tsc passes (web does not pull in
// @cloudflare/workers-types). Only what packages/web consumes is declared;
// the command-side helpers (projectWorkspace, kick/refresh/teardown) are
// internal to this package.

export declare const SYNC_PATH_PREFIX: string;
export declare const SYNC_ADMIN_PATH_PREFIX: string;

/**
 * Handles `/api/sync/<projectId>` WebSocket upgrades and
 * `/api/sync-admin/<projectId>/<op>` admin requests; resolves null for
 * anything else so the worker entry can fall through to TanStack Start.
 */
export declare function handleSyncFetch(
  request: Request,
  env: unknown,
): Promise<Response | null>;
