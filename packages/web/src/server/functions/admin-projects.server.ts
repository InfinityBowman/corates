import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import {
  projects,
  projectMembers,
  projectInvitations,
  mediaFiles,
  organization,
  user,
} from '@corates/db/schema';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { containsInsensitive } from '@/server/lib/sqlSearch';
import { throwDomainError, AUTH_ERRORS, PROJECT_ERRORS } from '@corates/shared';
import { isAdminUser } from '@corates/workers/auth-admin';
import { projectWorkspace } from '@corates/workers/sync';
import type { Session } from '@/server/middleware/auth';

function assertAdmin(session: Session) {
  if (!isAdminUser(session.user as { role?: string | null })) {
    throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' });
  }
}

export async function listAdminProjects(
  session: Session,
  db: Database,
  params: { page?: number; limit?: number; search?: string; orgId?: string },
) {
  assertAdmin(session);

  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (params.search) {
    conditions.push(containsInsensitive(projects.name, params.search));
  }
  if (params.orgId) conditions.push(eq(projects.orgId, params.orgId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const totalCountQuery =
    whereClause ?
      db.select({ count: count() }).from(projects).where(whereClause)
    : db.select({ count: count() }).from(projects);

  const [totalResult] = await totalCountQuery.all();
  const total = totalResult?.count || 0;

  const baseQuery = db
    .select({
      id: projects.id,
      name: projects.name,
      orgId: projects.orgId,
      orgName: organization.name,
      orgSlug: organization.slug,
      createdBy: projects.createdBy,
      creatorName: user.name,
      creatorGivenName: user.givenName,
      creatorEmail: user.email,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(organization, eq(projects.orgId, organization.id))
    .leftJoin(user, eq(projects.createdBy, user.id));

  const projectList = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
    .orderBy(desc(projects.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const projectIds = projectList.map(p => p.id);
  const statsMap: Record<string, { memberCount: number; fileCount: number }> = {};

  if (projectIds.length > 0) {
    const memberCounts = await db
      .select({ projectId: projectMembers.projectId, count: count() })
      .from(projectMembers)
      .where(
        sql`${projectMembers.projectId} IN (${sql.join(
          projectIds.map(id => sql`${id}`),
          sql`, `,
        )})`,
      )
      .groupBy(projectMembers.projectId)
      .all();

    const fileCounts = await db
      .select({ projectId: mediaFiles.projectId, count: count() })
      .from(mediaFiles)
      .where(
        sql`${mediaFiles.projectId} IN (${sql.join(
          projectIds.map(id => sql`${id}`),
          sql`, `,
        )})`,
      )
      .groupBy(mediaFiles.projectId)
      .all();

    for (const mc of memberCounts) {
      statsMap[mc.projectId] = { memberCount: mc.count, fileCount: 0 };
    }
    for (const fc of fileCounts) {
      if (!statsMap[fc.projectId]) {
        statsMap[fc.projectId] = { memberCount: 0, fileCount: fc.count };
      } else {
        statsMap[fc.projectId].fileCount = fc.count;
      }
    }
  }

  return {
    projects: projectList.map(p => ({
      ...p,
      memberCount: statsMap[p.id]?.memberCount || 0,
      fileCount: statsMap[p.id]?.fileCount || 0,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getAdminProjectDetails(session: Session, db: Database, projectId: string) {
  assertAdmin(session);

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      orgId: projects.orgId,
      orgName: organization.name,
      orgSlug: organization.slug,
      createdBy: projects.createdBy,
      creatorName: user.name,
      creatorGivenName: user.givenName,
      creatorEmail: user.email,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(organization, eq(projects.orgId, organization.id))
    .leftJoin(user, eq(projects.createdBy, user.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throwDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
  }

  const members = await db
    .select({
      id: projectMembers.id,
      userId: projectMembers.userId,
      userName: user.name,
      userGivenName: user.givenName,
      userEmail: user.email,
      userAvatar: user.image,
      role: projectMembers.role,
      joinedAt: projectMembers.joinedAt,
    })
    .from(projectMembers)
    .leftJoin(user, eq(projectMembers.userId, user.id))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(desc(projectMembers.joinedAt))
    .all();

  const files = await db
    .select({
      id: mediaFiles.id,
      filename: mediaFiles.filename,
      originalName: mediaFiles.originalName,
      fileType: mediaFiles.fileType,
      fileSize: mediaFiles.fileSize,
      uploadedBy: mediaFiles.uploadedBy,
      uploaderName: user.name,
      uploaderGivenName: user.givenName,
      studyId: mediaFiles.studyId,
      createdAt: mediaFiles.createdAt,
    })
    .from(mediaFiles)
    .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
    .where(eq(mediaFiles.projectId, projectId))
    .orderBy(desc(mediaFiles.createdAt))
    .all();

  const invitations = await db
    .select({
      id: projectInvitations.id,
      email: projectInvitations.email,
      role: projectInvitations.role,
      invitedBy: projectInvitations.invitedBy,
      inviterName: user.name,
      inviterGivenName: user.givenName,
      expiresAt: projectInvitations.expiresAt,
      acceptedAt: projectInvitations.acceptedAt,
      createdAt: projectInvitations.createdAt,
      grantOrgMembership: projectInvitations.grantOrgMembership,
    })
    .from(projectInvitations)
    .leftJoin(user, eq(projectInvitations.invitedBy, user.id))
    .where(eq(projectInvitations.projectId, projectId))
    .orderBy(desc(projectInvitations.createdAt))
    .limit(50)
    .all();

  const totalStorageBytes = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);

  return {
    project,
    members,
    files,
    invitations,
    stats: {
      memberCount: members.length,
      fileCount: files.length,
      totalStorageBytes,
    },
  };
}

export interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  userAvatar?: string;
  userDisplayName?: string;
  userName?: string;
  userEmail?: string;
  joinedAt?: string | number | Date;
}

export interface ProjectFile {
  id: string;
  originalName?: string;
  filename?: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy?: string;
  uploaderDisplayName?: string;
  uploaderName?: string;
  createdAt?: string | number | Date;
}

export interface ProjectInvitation {
  id: string;
  email: string;
  role: string;
  grantOrgMembership?: boolean;
  acceptedAt?: string | number | Date | null;
  expiresAt?: number;
  invitedBy: string;
  inviterDisplayName?: string;
  inviterName?: string;
  createdAt?: string | number | Date;
}

export interface ProjectData {
  project: {
    id: string;
    name: string;
    orgId: string;
    orgName: string;
    orgSlug: string;
    createdBy: string;
    creatorDisplayName?: string;
    creatorName?: string;
    creatorEmail?: string;
    createdAt?: string | number | Date;
    updatedAt?: string | number | Date;
  };
  stats: {
    memberCount: number;
    fileCount: number;
    totalStorageBytes: number;
  };
  members?: ProjectMember[];
  files?: ProjectFile[];
  invitations?: ProjectInvitation[];
}

/** The sync-engine workspace's admin stats (`workspaceAdmin(...).stats()`). */
export interface WorkspaceStats {
  workspaceId: string;
  backendId: string;
  schemaVersion: number;
  currentVersion: number;
  rows: { live: number; tombstones: number };
  mutationLogEntries: number;
  knownClients: number;
  databaseSizeBytes: number;
  connections: { total: number; ready: number; presence: number };
  /** The Yjs fields add-on's stats, when mounted. */
  extension?: {
    fields: number;
    frozenFields: number;
    fieldBytes: number;
    pendingUpdates: number;
    cachedDocs: number;
  };
}

export type AdminProjectListItem = Awaited<
  ReturnType<typeof listAdminProjects>
>['projects'][number];
export type AdminProjectDetails = Awaited<ReturnType<typeof getAdminProjectDetails>>;
export type AdminProjectMember = AdminProjectDetails['members'][number];
export type AdminProjectFile = AdminProjectDetails['files'][number];
export type AdminProjectInvitation = AdminProjectDetails['invitations'][number];

export async function getAdminWorkspaceStats(session: Session, db: Database, projectId: string) {
  assertAdmin(session);

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throwDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
  }

  const stats = await projectWorkspace(env, projectId).stats();
  return stats as WorkspaceStats;
}

export async function removeAdminProjectMember(
  session: Session,
  db: Database,
  projectId: string,
  memberId: string,
) {
  assertAdmin(session);

  const [existingMember] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  if (!existingMember) {
    throwDomainError(PROJECT_ERRORS.NOT_FOUND, { memberId });
  }

  await db.delete(projectMembers).where(eq(projectMembers.id, memberId));
  return { success: true, message: 'Member removed from project' };
}

export async function deleteAdminProject(session: Session, db: Database, projectId: string) {
  assertAdmin(session);

  const [existingProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!existingProject) {
    throwDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
  }

  await db.delete(projects).where(eq(projects.id, projectId));
  return { success: true, message: 'Project deleted' };
}
