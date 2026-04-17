import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  isDomainError,
  PROJECT_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { updateProject, deleteProject } from '@corates/workers/commands/projects';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';

type HandlerArgs = { request: Request; params: { orgId: string; projectId: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(request, env, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  const db = createDb(env.DB);
  try {
    const result = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        orgId: projects.orgId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .where(eq(projects.id, params.projectId))
      .get();

    if (!result) {
      return Response.json(
        createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId: params.projectId }),
        { status: 404 },
      );
    }

    return Response.json({ ...result, role: access.context.projectRole }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching project:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_project',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handlePut = async ({ request, params }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, env, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  const access = await requireProjectAccess(
    request,
    env,
    params.orgId,
    params.projectId,
    'member',
  );
  if (!access.ok) return access.response;

  let body: { name?: unknown; description?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
    error.message = 'Invalid JSON input';
    return Response.json(error, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name : undefined;
  const description = typeof body.description === 'string' ? body.description : undefined;

  if (name !== undefined) {
    if (name.length < 1) {
      return Response.json(
        createValidationError('name', VALIDATION_ERRORS.INVALID_INPUT.code, name, 'empty'),
        { status: 400 },
      );
    }
    if (name.length > 255) {
      return Response.json(
        createValidationError('name', VALIDATION_ERRORS.INVALID_INPUT.code, name, 'max_length_255'),
        { status: 400 },
      );
    }
  }
  if (description && description.length > 2000) {
    return Response.json(
      createValidationError(
        'description',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        description,
        'max_length_2000',
      ),
      { status: 400 },
    );
  }

  try {
    const result = await updateProject(
      env,
      { id: access.context.userId },
      { projectId: params.projectId, name, description },
    );
    return Response.json({ success: true as const, projectId: result.projectId }, { status: 200 });
  } catch (err) {
    if (isDomainError(err)) {
      return Response.json(err, { status: 403 });
    }
    const error = err as Error;
    console.error('Error updating project:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_project',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handleDelete = async ({ request, params }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, env, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  const access = await requireProjectAccess(request, env, params.orgId, params.projectId, 'owner');
  if (!access.ok) return access.response;

  try {
    const result = await deleteProject(
      env,
      { id: access.context.userId, email: access.context.userEmail },
      { projectId: params.projectId },
    );
    return Response.json({ success: true as const, deleted: result.deleted }, { status: 200 });
  } catch (err) {
    if (isDomainError(err)) {
      return Response.json(err, { status: 403 });
    }
    const error = err as Error;
    console.error('Error deleting project:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'delete_project',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/projects/$projectId')({
  server: {
    handlers: {
      GET: handleGet,
      PUT: handlePut,
      DELETE: handleDelete,
    },
  },
});
