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
import { and, count, desc, eq, like, sql } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS, PROJECT_ERRORS } from '@corates/shared';
import { isAdminUser } from '@corates/workers/auth-admin';
import { getProjectDocStub } from '@corates/workers/project-doc-id';
import type { Session } from '@/server/middleware/auth';

function assertAdmin(session: Session) {
  if (!isAdminUser(session.user as { role?: string | null })) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' }), {
      status: 403,
    });
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
    conditions.push(like(sql`LOWER(${projects.name})`, `%${params.search.toLowerCase()}%`));
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
      description: projects.description,
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
      description: projects.description,
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
    throw Response.json(createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId }), {
      status: 404,
    });
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

export async function getAdminProjectDocStats(session: Session, db: Database, projectId: string) {
  assertAdmin(session);

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw Response.json(createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId }), {
      status: 404,
    });
  }

  const projectDoc = getProjectDocStub(env, projectId);
  return projectDoc.getStorageStats();
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
    throw Response.json(createDomainError(PROJECT_ERRORS.NOT_FOUND, { memberId }), {
      status: 404,
    });
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
    throw Response.json(createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId }), {
      status: 404,
    });
  }

  await db.delete(projects).where(eq(projects.id, projectId));
  return { success: true, message: 'Project deleted' };
}
