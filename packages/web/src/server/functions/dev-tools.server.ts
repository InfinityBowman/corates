import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import type { OrgId, ProjectId } from '@corates/shared/ids';
import { getProjectDocStub } from '@corates/workers/project-doc-id';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import type { Session } from '@/server/middleware/auth';

function assertDevMode() {
  if (!env.DEV_MODE) {
    throw Response.json({ error: 'Dev endpoints disabled' }, { status: 403 });
  }
}

export async function listDevTemplates(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
) {
  assertDevMode();

  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.response;

  const access = await requireProjectAccess(session, db, orgId, projectId);
  if (!access.ok) throw access.response;

  const projectDoc = getProjectDocStub(env, projectId);
  return projectDoc.devTemplates();
}

export async function applyDevTemplate(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  data: { template: string; mode: 'replace' | 'merge'; userMapping?: Record<string, string> },
) {
  assertDevMode();

  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.response;

  const access = await requireProjectAccess(session, db, orgId, projectId);
  if (!access.ok) throw access.response;

  const projectDoc = getProjectDocStub(env, projectId);
  return projectDoc.devApplyTemplate(data.template, data.mode, data.userMapping);
}

export async function devImportState(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  body: Record<string, unknown>,
) {
  assertDevMode();

  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.response;

  const access = await requireProjectAccess(session, db, orgId, projectId);
  if (!access.ok) throw access.response;

  const projectDoc = getProjectDocStub(env, projectId);
  return projectDoc.devImport({
    ...body,
    targetOrgId: access.context.orgId,
    importer: {
      userId: access.context.userId,
      email: access.context.userEmail,
      name: null,
      image: null,
    },
  });
}

export async function devResetState(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
) {
  assertDevMode();

  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.response;

  const access = await requireProjectAccess(session, db, orgId, projectId);
  if (!access.ok) throw access.response;

  const projectDoc = getProjectDocStub(env, projectId);
  return projectDoc.devReset();
}

export async function devExportState(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
) {
  assertDevMode();

  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.response;

  const access = await requireProjectAccess(session, db, orgId, projectId);
  if (!access.ok) throw access.response;

  const projectDoc = getProjectDocStub(env, projectId);
  return projectDoc.devExport();
}

export async function devAddStudy(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  body: Record<string, unknown>,
) {
  assertDevMode();

  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.response;

  const access = await requireProjectAccess(session, db, orgId, projectId);
  if (!access.ok) throw access.response;

  const projectDoc = getProjectDocStub(env, projectId);
  return projectDoc.devAddStudy(body);
}
