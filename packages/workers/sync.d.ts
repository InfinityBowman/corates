// Public type surface for @corates/workers/sync.
//
// Hand-maintained stub mirroring the runtime exports from src/sync/index.ts.
// Same firewall pattern as durable-objects.d.ts — keeps @cf-sync/server's
// Cloudflare runtime types out of consumers' tsc passes (web does not pull in
// @cloudflare/workers-types). Only what packages/web consumes is declared;
// `env` parameters are `unknown` because the worker Env type lives behind
// the firewall.

export declare const SYNC_PATH_PREFIX: string;
export declare const SYNC_ADMIN_PATH_PREFIX: string;

/**
 * Kick one user's live sync sessions for a project (permanent close;
 * reconnects re-run authorize against D1). Best-effort: failures are logged,
 * never thrown.
 */
export declare function kickWorkspaceUser(
  env: unknown,
  projectId: string,
  userId: string,
  reason?: string,
): Promise<void>;

/**
 * Typed admin surface over one project's workspace for same-worker callers
 * (stats/export/import/reset/disconnect). Only what web consumes is declared.
 */
export declare function projectWorkspace(
  env: unknown,
  projectId: string,
): {
  stats(): Promise<unknown>;
  export(): Promise<unknown>;
  import(snapshot: unknown): Promise<{ imported: number; version: number }>;
  reset(): Promise<{ reset: true }>;
  disconnect(opts?: {
    principal?: string;
    mode?: 'kick' | 'refresh';
    reason?: string;
  }): Promise<{ disconnected: number }>;
};

/**
 * Handles `/api/sync/<projectId>` WebSocket upgrades and
 * `/api/sync-admin/<projectId>/<op>` admin requests; resolves null for
 * anything else so the worker entry can fall through to TanStack Start.
 */
export declare function handleSyncFetch(request: Request, env: unknown): Promise<Response | null>;
