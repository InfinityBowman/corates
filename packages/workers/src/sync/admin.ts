/**
 * Same-worker admin helpers over the project sync DO — the forced-disconnect
 * seams commands and billing hooks call. Kept separate from ./project-sync.ts so
 * auth/config.ts can import them without a cycle (project-sync.ts imports
 * verifyAuth from auth/config for its authorize hook).
 */

import { workspaceAdmin } from '@cf-sync/server';
import { eq } from 'drizzle-orm';
import type { Database } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { purgeProjectSnapshots } from '../lib/backup-storage';
import { captureError, info } from '../lib/logger';
import type { Env } from '../types';

/** Typed admin surface over one project's sync DO, for same-worker callers. */
export function projectSync(env: Env, projectId: string) {
  return workspaceAdmin(env.PROJECT_SYNC, projectId);
}

/**
 * Kick a removed member's live sync sessions. Permanent close: the client
 * stops reconnecting and surfaces the reason. Failure is tolerated (D1 is the
 * authority; an open socket without membership can read pokes until it
 * naturally dies) but logged.
 */
export async function kickSyncUser(
  env: Env,
  projectId: string,
  userId: string,
  reason: string = 'membership-revoked',
): Promise<void> {
  try {
    await projectSync(env, projectId).disconnect({ principal: userId, reason });
    info('sync.kicked', { projectId, userId, reason });
  } catch (err) {
    captureError(err, {
      tags: { component: 'project-sync', action: 'kick-user' },
      extra: { projectId, userId },
    });
  }
}

/**
 * Refresh-disconnect one project's live sync sessions so reconnects re-run
 * authorize (fresh role/writeAllowed stamps) and clients treat the re-sync as
 * a membership poke (ConnectionPool refetches the members query). Called on
 * membership changes; best-effort — D1 is the authority either way.
 */
export async function refreshSyncSessions(env: Env, projectId: string): Promise<void> {
  try {
    await projectSync(env, projectId).disconnect({ mode: 'refresh' });
    info('sync.sessions_refreshed', { projectId });
  } catch (err) {
    captureError(err, {
      tags: { component: 'project-sync', action: 'refresh-sessions' },
      extra: { projectId },
    });
  }
}

/**
 * Refresh-disconnect every live sync session across an org's projects so
 * reconnects re-run authorize and pick up fresh `writeAllowed` stamps — the
 * freshness mechanism for subscription changes. Best-effort per project.
 */
export async function refreshOrgSyncSessions(env: Env, db: Database, orgId: string): Promise<void> {
  const orgProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.orgId, orgId))
    .all();

  for (const project of orgProjects) {
    try {
      await projectSync(env, project.id).disconnect({ mode: 'refresh' });
      info('sync.sessions_refreshed', { orgId, projectId: project.id });
    } catch (err) {
      captureError(err, {
        tags: { component: 'project-sync', action: 'refresh-org-sessions' },
        extra: { orgId, projectId: project.id },
      });
    }
  }
}

/**
 * Project deletion: close every session permanently, then wipe the sync DO
 * storage and its daily backups. Best-effort — D1 deletion is the
 * authoritative act. Callers take the final `deleted/` snapshot
 * (snapshotBeforeDelete) before the D1 delete, because that envelope needs
 * rows the cascade removes.
 */
export async function teardownProjectSync(env: Env, projectId: string): Promise<void> {
  try {
    const sync = projectSync(env, projectId);
    await sync.disconnect({ reason: 'project-deleted' });
    await sync.reset();
    await purgeProjectSnapshots(env, projectId);
  } catch (err) {
    captureError(err, {
      tags: { component: 'project-sync', action: 'teardown' },
      extra: { projectId },
    });
  }
}
