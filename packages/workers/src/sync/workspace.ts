/**
 * The sync-engine workspace: DO class, worker routes, and the admin helpers
 * commands use for forced disconnects.
 *
 * Workspace = project; the workspace id IS the projectId (its own namespace
 * binding, so no name-prefix dance like ProjectDoc's `project:` ids). The
 * socket route is `/api/sync/<projectId>`; the admin surface
 * (`/api/sync-admin/<projectId>/<op>`) is bearer-token-gated for the
 * migration tooling (export/import/stats/reset) and external operators —
 * same-worker code goes through `projectWorkspace()` instead.
 */

import {
  bearerTokenAuth,
  createAdminRoute,
  createSyncRoute,
  createWorkspaceDO,
} from '@cf-sync/server';
import { syncApp } from '@corates/shared/sync';
import { createDb } from '@corates/db/client';
import { verifyAuth } from '../auth/config';
import type { Env } from '../types';
import { buildSyncVerdict } from './authorize';

export class WorkspaceDO extends createWorkspaceDO({ app: syncApp }) {}

export const SYNC_PATH_PREFIX = '/api/sync';
export const SYNC_ADMIN_PATH_PREFIX = '/api/sync-admin';

const syncRoute = createSyncRoute<Env>({
  namespace: env => env.WORKSPACE,
  pathPrefix: SYNC_PATH_PREFIX,
  authorize: async (request, { workspaceId, env }) => {
    const { user } = await verifyAuth(request, env);
    if (!user) return { ok: false, reason: 'auth-required' };
    const verdict = await buildSyncVerdict(createDb(env.DB), user.id, workspaceId);
    if (!verdict.ok) return { ok: false, reason: verdict.reason };
    return { ok: true, principal: verdict.principal, context: verdict.context };
  },
});

const adminRoute = createAdminRoute<Env>({
  namespace: env => env.WORKSPACE,
  pathPrefix: SYNC_ADMIN_PATH_PREFIX,
  authorize: bearerTokenAuth(env => env.SYNC_ADMIN_TOKEN),
});

/**
 * Both sync-engine routes as one composable handler: resolves to null when
 * the request is neither, so the web worker entry chains it ahead of TanStack
 * Start with `??`-style fallthrough.
 */
export async function handleSyncFetch(request: Request, env: Env): Promise<Response | null> {
  return (await syncRoute(request, env)) ?? (await adminRoute(request, env));
}
