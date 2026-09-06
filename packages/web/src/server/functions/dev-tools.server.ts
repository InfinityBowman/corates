/**
 * Dev-only project state tools over the sync engine's admin surface:
 * export/import/reset a workspace snapshot from the dev panel. Seeding
 * (generated studies, templates) is client-side — see `@/dev/seed` — so the
 * only server-side dev surface left is the snapshot lifecycle, which needs
 * the same-worker `projectWorkspace` admin binding.
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
import { projectWorkspace } from '@corates/workers/sync';
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
type WorkspaceSnapshot = Record<string, JsonValue>;

export async function devExportState(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
) {
  await assertProjectDevAccess(session, db, orgId, projectId);
  const snapshot = await projectWorkspace(env, projectId).export();
  return snapshot as WorkspaceSnapshot;
}

export async function devImportState(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  snapshot: Record<string, unknown>,
) {
  await assertProjectDevAccess(session, db, orgId, projectId);
  const workspace = projectWorkspace(env, projectId);
  const result = await workspace.import(snapshot);
  await workspace.disconnect({ mode: 'refresh' });
  return result;
}

export async function devResetState(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
) {
  await assertProjectDevAccess(session, db, orgId, projectId);
  const workspace = projectWorkspace(env, projectId);
  const result = await workspace.reset();
  await workspace.disconnect({ mode: 'refresh' });
  return result;
}
