/**
 * Dev-only project state tools over the sync engine's admin surface:
 * export/import/reset a project's sync snapshot from the dev panel. Seeding
 * (generated studies, templates) is client-side — see `@/dev/seed` — so the
 * only server-side dev surface left is the snapshot lifecycle, which needs
 * the same-worker `projectSync` admin binding.
 *
 * Import and reset refresh-disconnect live sessions afterwards so every open
 * client reconnects and resyncs against the replaced state instead of
 * continuing from a stale cursor.
 */

import { env } from 'cloudflare:workers';
import { throwDomainError, AUTH_ERRORS } from '@corates/shared';
import type { JsonValue } from '@corates/shared/sync';
import type { Database } from '@corates/db/client';
import type { OrgId, ProjectId } from '@corates/shared/ids';
import { projectSync } from '@corates/workers/sync';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import type { Session } from '@/server/middleware/auth';

function assertDevMode() {
  if (!env.DEV_MODE) {
    throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'dev_endpoints_disabled' });
  }
}

async function assertProjectDevAccess(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
): Promise<void> {
  assertDevMode();

  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.error;

  const access = await requireProjectAccess(session, db, orgId, projectId);
  if (!access.ok) throw access.error;
}

/** JSON-shaped view of the engine snapshot, for the server-fn serializer. */
type SyncSnapshot = Record<string, JsonValue>;

export async function devExportState(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
) {
  await assertProjectDevAccess(session, db, orgId, projectId);
  const snapshot = await projectSync(env, projectId).export();
  return snapshot as SyncSnapshot;
}

export async function devImportState(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  snapshot: Record<string, unknown>,
) {
  await assertProjectDevAccess(session, db, orgId, projectId);
  const sync = projectSync(env, projectId);
  const result = await sync.import(snapshot);
  await sync.disconnect({ mode: 'refresh' });
  return result;
}

export async function devResetState(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
) {
  await assertProjectDevAccess(session, db, orgId, projectId);
  const sync = projectSync(env, projectId);
  const result = await sync.reset();
  await sync.disconnect({ mode: 'refresh' });
  return result;
}
