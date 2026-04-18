import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { projects, projectMembers } from '@corates/db/schema';
import { eq, and, count, desc } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  isDomainError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { createProject } from '@corates/workers/commands/projects';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';
import { requireEntitlement } from '@/server/guards/requireEntitlement';
import { requireQuota } from '@/server/guards/requireQuota';

type HandlerArgs = { request: Request; params: { orgId: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const membership = await requireOrgMembership(request, env, params.orgId);
  if (!membership.ok) return membership.response;

  const db = createDb(env.DB);
  try {
    const results = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        orgId: projects.orgId,
        role: projectMembers.role,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(
        and(eq(projects.orgId, params.orgId), eq(projectMembers.userId, membership.context.userId)),
      )
      .orderBy(desc(projects.updatedAt));

    return Response.json(results, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error listing org projects:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'list_org_projects',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handlePost = async ({ request, params }: HandlerArgs) => {
  const membership = await requireOrgMembership(request, env, params.orgId);
  if (!membership.ok) return membership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, env, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  const entitlement = await requireEntitlement(env, params.orgId, 'project.create');
  if (!entitlement.ok) return entitlement.response;

  const getProjectCount = async () => {
    const db = createDb(env.DB);
    const result = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, params.orgId))
      .get();
    return result?.count || 0;
  };

  const quota = await requireQuota(env, params.orgId, 'projects.max', getProjectCount, 1);
  if (!quota.ok) return quota.response;

  let body: { name?: unknown; description?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
    error.message = 'Invalid JSON input';
    return Response.json(error, { status: 400 });
  }

  if (typeof body.name !== 'string' || body.name.length < 1) {
    return Response.json(
      createValidationError('name', VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'required'),
      { status: 400 },
    );
  }
  if (body.name.length > 255) {
    return Response.json(
      createValidationError(
        'name',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        body.name,
        'max_length_255',
      ),
      { status: 400 },
    );
  }
  const description = typeof body.description === 'string' ? body.description : undefined;
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
    const { project } = await createProject(
      env,
      { id: membership.context.userId },
      {
        orgId: params.orgId,
        name: body.name,
        description,
      },
    );

    return Response.json(project, { status: 201 });
  } catch (err) {
    if (isDomainError(err)) {
      return Response.json(err, { status: 403 });
    }
    const error = err as Error;
    console.error('Error creating project:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_TRANSACTION_FAILED, {
        operation: 'create_project',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/projects')({
  server: {
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
});
