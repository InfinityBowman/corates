/**
 * Admin project details + delete
 *
 * GET /api/admin/projects/:projectId — project with org, creator, members,
 * files, and recent invitations. DELETE removes the project and cascades.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import {
  projects,
  projectMembers,
  projectInvitations,
  mediaFiles,
  organization,
  user,
} from '@corates/db/schema';
import { desc, eq } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';

type HandlerArgs = { request: Request; params: { projectId: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { projectId } = params;
  const db = createDb(env.DB);

  try {
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
      return Response.json(createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId }), {
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

    return Response.json(
      {
        project,
        members,
        files,
        invitations,
        stats: {
          memberCount: members.length,
          fileCount: files.length,
          totalStorageBytes,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching admin project detail:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, { message: error.message }),
      { status: 500 },
    );
  }
};

export const handleDelete = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { projectId } = params;
  const db = createDb(env.DB);

  try {
    const [existingProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!existingProject) {
      return Response.json(createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId }), {
        status: 404,
      });
    }

    await db.delete(projects).where(eq(projects.id, projectId));

    return Response.json({ success: true, message: 'Project deleted' }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error deleting project:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, { message: error.message }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/projects/$projectId')({
  server: { handlers: { GET: handleGet, DELETE: handleDelete } },
});
