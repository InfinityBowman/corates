/**
 * Same-worker admin helpers over the sync workspace — the forced-disconnect
 * seams commands and billing hooks call. Kept separate from ./workspace.ts so
 * auth/config.ts can import them without a cycle (workspace.ts imports
 * verifyAuth from auth/config for its authorize hook).
 */

import { workspaceAdmin } from '@cf-sync/server';
import { eq } from 'drizzle-orm';
import type { Database } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { captureError } from '../lib/logger';
import type { Env } from '../types';

/** Typed admin surface over one project's workspace, for same-worker callers. */
export function projectWorkspace(env: Env, projectId: string) {
  return workspaceAdmin(env.WORKSPACE, projectId);
}

/**
 * Kick a removed member's live sync sessions. Permanent close: the client
 * stops reconnecting and surfaces the reason. Failure is tolerated (D1 is the
 * authority; an open socket without membership can read pokes until it
 * naturally dies) but logged.
 */
export async function kickWorkspaceUser(
  env: Env,
  projectId: string,
  userId: string,
  reason: string = 'membership-revoked',
): Promise<void> {
  try {
    await projectWorkspace(env, projectId).disconnect({ principal: userId, reason });
  } catch (err) {
    captureError(err, {
      tags: { component: 'workspace-sync', action: 'kick-user' },
      extra: { projectId, userId },
    });
  }
}

/**
 * Refresh-disconnect every live sync session across an org's projects so
 * reconnects re-run authorize and pick up fresh `writeAllowed` stamps — the
 * freshness mechanism for subscription changes. Best-effort per project.
 */
export async function refreshOrgWorkspaceSessions(
  env: Env,
  db: Database,
  orgId: string,
): Promise<void> {
  const orgProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.orgId, orgId))
    .all();

  for (const project of orgProjects) {
    try {
      await projectWorkspace(env, project.id).disconnect({ mode: 'refresh' });
    } catch (err) {
      captureError(err, {
        tags: { component: 'workspace-sync', action: 'refresh-org-sessions' },
        extra: { orgId, projectId: project.id },
      });
    }
  }
}

/**
 * Project deletion: close every session permanently, then wipe the workspace
 * storage. Best-effort — D1 deletion is the authoritative act.
 */
export async function teardownWorkspace(env: Env, projectId: string): Promise<void> {
  try {
    const workspace = projectWorkspace(env, projectId);
    await workspace.disconnect({ reason: 'project-deleted' });
    await workspace.reset();
  } catch (err) {
    captureError(err, {
      tags: { component: 'workspace-sync', action: 'teardown' },
      extra: { projectId },
    });
  }
}
