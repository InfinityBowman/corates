/**
 * Organization routes for Hono
 * Wraps Better Auth organization plugin APIs - delegates to plugin as service boundary
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Context, MiddlewareHandler } from 'hono';
import { createDb } from '@/db/client.js';
import { projects } from '@/db/schema.js';
import { eq, count } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { requireOrgMembership } from '@/middleware/requireOrg.js';
import { requireOrgWriteAccess } from '@/middleware/requireOrgWriteAccess.js';
import { createDomainError, isDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { createAuth } from '@/auth/config.js';
import { orgProjectRoutes } from './projects.js';
import { requireOrgMemberRemoval } from '@/policies';
import { validationHook } from '@/lib/honoValidationHook.js';
import type { Env } from '../../types';

// Type definitions for Better Auth organization plugin API methods
// These are provided by the organization plugin but TypeScript can't infer them
interface OrgApiRequest {
  headers: Headers;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

interface OrgApiMethods {
  listOrganizations: (req: OrgApiRequest) => Promise<unknown>;
  createOrganization: (req: OrgApiRequest) => Promise<unknown>;
  getFullOrganization: (req: OrgApiRequest) => Promise<unknown>;
  updateOrganization: (req: OrgApiRequest) => Promise<unknown>;
  deleteOrganization: (req: OrgApiRequest) => Promise<unknown>;
  listMembers: (req: OrgApiRequest) => Promise<unknown>;
  addMember: (req: OrgApiRequest) => Promise<unknown>;
  updateMemberRole: (req: OrgApiRequest) => Promise<unknown>;
  removeMember: (req: OrgApiRequest) => Promise<unknown>;
  leaveOrganization: (req: OrgApiRequest) => Promise<unknown>;
  setActiveOrganization: (req: OrgApiRequest) => Promise<unknown>;
}

// Helper to get typed organization API
function getOrgApi(
  env: Env,
  ctx?: { waitUntil: (promise: Promise<unknown>) => void },
): OrgApiMethods {
  const auth = createAuth(env, ctx);
  return auth.api as unknown as OrgApiMethods;
}

const orgRoutes = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

// Response schemas
const OrganizationSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string().nullable(),
    logo: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.string(),
  })
  .openapi('Organization');

const OrganizationListResponseSchema = z.array(OrganizationSchema).openapi('OrganizationList');

const OrganizationDetailSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string().nullable(),
    logo: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.string(),
    members: z.array(z.record(z.string(), z.unknown())).optional(),
    invitations: z.array(z.record(z.string(), z.unknown())).optional(),
    projectCount: z.number(),
  })
  .openapi('OrganizationDetail');

const CreateOrgRequestSchema = z
  .object({
    name: z.string().min(1).openapi({ example: 'My Organization' }),
    slug: z.string().optional().openapi({ example: 'my-org' }),
    logo: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('CreateOrgRequest');

const UpdateOrgRequestSchema = z
  .object({
    name: z.string().optional(),
    slug: z.string().optional(),
    logo: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('UpdateOrgRequest');

const MemberSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    organizationId: z.string(),
    role: z.string(),
    createdAt: z.string(),
    user: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string(),
        image: z.string().nullable(),
      })
      .optional(),
  })
  .openapi('OrgMember');

const MembersListResponseSchema = z
  .object({
    members: z.array(MemberSchema),
  })
  .openapi('MembersListResponse');

const AddMemberRequestSchema = z
  .object({
    userId: z.string().min(1).openapi({ example: 'user-123' }),
    role: z.enum(['member', 'admin', 'owner']).optional().default('member'),
  })
  .openapi('AddMemberRequest');

const UpdateMemberRoleRequestSchema = z
  .object({
    role: z.enum(['member', 'admin', 'owner']).openapi({ example: 'admin' }),
  })
  .openapi('UpdateMemberRoleRequest');

const OrgErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('OrgError');

// Route definitions
const listOrgsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Organizations'],
  summary: 'List organizations',
  description: 'List organizations the user is a member of',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: OrganizationListResponseSchema } },
      description: 'List of organizations',
    },
    500: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Database error',
    },
  },
});

const createOrgRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Organizations'],
  summary: 'Create organization',
  description: 'Create a new organization',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateOrgRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: OrganizationSchema } },
      description: 'Organization created',
    },
    403: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Name required or slug taken',
    },
    500: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Database error',
    },
  },
});

const getOrgRoute = createRoute({
  method: 'get',
  path: '/{orgId}',
  tags: ['Organizations'],
  summary: 'Get organization',
  description: 'Get organization details (requires membership)',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      orgId: z.string().min(1).openapi({ example: 'org-123' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OrganizationDetailSchema } },
      description: 'Organization details',
    },
    403: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Not a member or org not found',
    },
    500: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Database error',
    },
  },
});

const updateOrgRoute = createRoute({
  method: 'put',
  path: '/{orgId}',
  tags: ['Organizations'],
  summary: 'Update organization',
  description: 'Update organization (requires admin or owner role)',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      orgId: z.string().min(1).openapi({ example: 'org-123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateOrgRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.literal(true),
              orgId: z.string(),
            })
            .openapi('UpdateOrgResponse'),
        },
      },
      description: 'Organization updated',
    },
    403: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Not authorized or slug taken',
    },
    500: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Database error',
    },
  },
});

const deleteOrgRoute = createRoute({
  method: 'delete',
  path: '/{orgId}',
  tags: ['Organizations'],
  summary: 'Delete organization',
  description: 'Delete organization (requires owner role)',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      orgId: z.string().min(1).openapi({ example: 'org-123' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.literal(true),
              deleted: z.string(),
            })
            .openapi('DeleteOrgResponse'),
        },
      },
      description: 'Organization deleted',
    },
    403: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Not authorized',
    },
    500: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Database error',
    },
  },
});

const listMembersRoute = createRoute({
  method: 'get',
  path: '/{orgId}/members',
  tags: ['Organizations'],
  summary: 'List members',
  description: 'List organization members',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      orgId: z.string().min(1).openapi({ example: 'org-123' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MembersListResponseSchema } },
      description: 'Members list',
    },
    403: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Not a member',
    },
    500: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Database error',
    },
  },
});

const addMemberRoute = createRoute({
  method: 'post',
  path: '/{orgId}/members',
  tags: ['Organizations'],
  summary: 'Add member',
  description: 'Add member to organization (requires admin or owner role)',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      orgId: z.string().min(1).openapi({ example: 'org-123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: AddMemberRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.literal(true),
              member: MemberSchema.optional(),
            })
            .openapi('AddMemberResponse'),
        },
      },
      description: 'Member added',
    },
    403: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Not authorized or already a member',
    },
    500: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Database error',
    },
  },
});

const updateMemberRoleRoute = createRoute({
  method: 'put',
  path: '/{orgId}/members/{memberId}',
  tags: ['Organizations'],
  summary: 'Update member role',
  description: 'Update member role (requires admin or owner role)',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      orgId: z.string().min(1).openapi({ example: 'org-123' }),
      memberId: z.string().min(1).openapi({ example: 'member-456' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateMemberRoleRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.literal(true),
              memberId: z.string(),
              role: z.string(),
            })
            .openapi('UpdateMemberRoleResponse'),
        },
      },
      description: 'Role updated',
    },
    403: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Not authorized',
    },
    500: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Database error',
    },
  },
});

const removeMemberRoute = createRoute({
  method: 'delete',
  path: '/{orgId}/members/{memberId}',
  tags: ['Organizations'],
  summary: 'Remove member',
  description: 'Remove member from organization (requires admin or owner role, or self-removal)',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      orgId: z.string().min(1).openapi({ example: 'org-123' }),
      memberId: z.string().min(1).openapi({ example: 'member-456' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.literal(true),
              removed: z.string(),
              isSelf: z.boolean(),
            })
            .openapi('RemoveMemberResponse'),
        },
      },
      description: 'Member removed',
    },
    403: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Not authorized or cannot remove last owner',
    },
    500: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Database error',
    },
  },
});

const setActiveOrgRoute = createRoute({
  method: 'post',
  path: '/{orgId}/set-active',
  tags: ['Organizations'],
  summary: 'Set active organization',
  description: "Set this organization as the user's active organization",
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      orgId: z.string().min(1).openapi({ example: 'org-123' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.literal(true),
              activeOrganizationId: z.string(),
            })
            .openapi('SetActiveOrgResponse'),
        },
      },
      description: 'Active organization set',
    },
    403: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Not a member',
    },
    500: {
      content: { 'application/json': { schema: OrgErrorSchema } },
      description: 'Database error',
    },
  },
});

/**
 * Helper to run middleware manually and check for early response
 */
async function runMiddleware(middleware: MiddlewareHandler, c: Context): Promise<Response | null> {
  let nextCalled = false;

  const result = await middleware(c, async () => {
    nextCalled = true;
  });

  // If middleware returned a Response (early return), return it
  if (result instanceof Response) {
    return result;
  }

  // If next() wasn't called, the middleware returned early via c.json()
  if (!nextCalled && c.res) {
    return c.res;
  }

  return null;
}

// Apply auth middleware to all routes
orgRoutes.use('*', requireAuth);

// Route handlers
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(listOrgsRoute, async c => {
  try {
    const orgApi = getOrgApi(c.env, c.executionCtx);
    const result = await orgApi.listOrganizations({
      headers: c.req.raw.headers,
    });

    return c.json(result);
  } catch (err) {
    const error = err as Error;
    console.error('Error listing organizations:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_organizations',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(createOrgRoute, async c => {
  try {
    const body = c.req.valid('json');

    if (!body.name?.trim()) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'name_required',
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const orgApi = getOrgApi(c.env, c.executionCtx);
    const result = await orgApi.createOrganization({
      headers: c.req.raw.headers,
      body: {
        name: body.name.trim(),
        slug: body.slug,
        logo: body.logo,
        metadata: body.metadata,
      },
    });

    return c.json(result, 201);
  } catch (err) {
    const error = err as Error;
    console.error('Error creating organization:', error);
    if (error.message?.includes('slug')) {
      const slugError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'slug_taken',
      });
      return c.json(slugError, slugError.statusCode as ContentfulStatusCode);
    }
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_organization',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(getOrgRoute, async c => {
  // Run membership middleware
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const { orgId } = c.req.valid('param');

  try {
    const orgApi = getOrgApi(c.env, c.executionCtx);
    const result = await orgApi.getFullOrganization({
      headers: c.req.raw.headers,
      query: {
        organizationId: orgId,
      },
    });

    if (!result) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_not_found',
        orgId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const db = createDb(c.env.DB);
    const [projectCount] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    return c.json({
      ...result,
      projectCount: projectCount?.count || 0,
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching organization:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_organization',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(updateOrgRoute, async c => {
  // Run membership middleware (admin required)
  const membershipResponse = await runMiddleware(requireOrgMembership('admin'), c);
  if (membershipResponse) return membershipResponse;

  // Run write access middleware
  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const { orgId } = c.req.valid('param');

  try {
    const body = c.req.valid('json');

    const orgApi = getOrgApi(c.env, c.executionCtx);
    const result = await orgApi.updateOrganization({
      headers: c.req.raw.headers,
      body: {
        organizationId: orgId,
        data: {
          name: body.name,
          slug: body.slug,
          logo: body.logo,
          metadata: body.metadata,
        },
      },
    });

    return c.json({ success: true as const, orgId, ...(result as Record<string, unknown>) });
  } catch (err) {
    const error = err as Error;
    console.error('Error updating organization:', error);
    if (error.message?.includes('slug')) {
      const slugError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'slug_taken',
      });
      return c.json(slugError, slugError.statusCode as ContentfulStatusCode);
    }
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_organization',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(deleteOrgRoute, async c => {
  // Run membership middleware (owner required)
  const membershipResponse = await runMiddleware(requireOrgMembership('owner'), c);
  if (membershipResponse) return membershipResponse;

  // Run write access middleware
  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const { orgId } = c.req.valid('param');

  try {
    const orgApi = getOrgApi(c.env, c.executionCtx);
    await orgApi.deleteOrganization({
      headers: c.req.raw.headers,
      body: {
        organizationId: orgId,
      },
    });

    return c.json({ success: true as const, deleted: orgId });
  } catch (err) {
    const error = err as Error;
    console.error('Error deleting organization:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_organization',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(listMembersRoute, async c => {
  // Run membership middleware
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const { orgId } = c.req.valid('param');

  try {
    const orgApi = getOrgApi(c.env, c.executionCtx);
    const result = await orgApi.listMembers({
      headers: c.req.raw.headers,
      query: {
        organizationId: orgId,
      },
    });

    return c.json(result);
  } catch (err) {
    const error = err as Error;
    console.error('Error listing org members:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_org_members',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(addMemberRoute, async c => {
  // Run membership middleware (admin required)
  const membershipResponse = await runMiddleware(requireOrgMembership('admin'), c);
  if (membershipResponse) return membershipResponse;

  // Run write access middleware
  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const { orgId } = c.req.valid('param');

  try {
    const body = c.req.valid('json');

    const orgApi = getOrgApi(c.env, c.executionCtx);
    const result = await orgApi.addMember({
      body: {
        organizationId: orgId,
        userId: body.userId,
        role: body.role,
      },
      headers: c.req.raw.headers,
    });

    return c.json({ success: true as const, ...(result as Record<string, unknown>) }, 201);
  } catch (err) {
    const error = err as Error;
    console.error('Error adding org member:', error);
    if (error.message?.includes('already') || error.message?.includes('member')) {
      const memberError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'already_member',
      });
      return c.json(memberError, memberError.statusCode as ContentfulStatusCode);
    }
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'add_org_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(updateMemberRoleRoute, async c => {
  // Run membership middleware (admin required)
  const membershipResponse = await runMiddleware(requireOrgMembership('admin'), c);
  if (membershipResponse) return membershipResponse;

  // Run write access middleware
  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const { orgId, memberId } = c.req.valid('param');

  try {
    const body = c.req.valid('json');

    const orgApi = getOrgApi(c.env, c.executionCtx);
    await orgApi.updateMemberRole({
      headers: c.req.raw.headers,
      body: {
        organizationId: orgId,
        memberId,
        role: body.role,
      },
    });

    return c.json({ success: true as const, memberId, role: body.role });
  } catch (err) {
    const error = err as Error;
    console.error('Error updating org member:', error);
    if (error.message?.includes('owner') || error.message?.includes('permission')) {
      const permError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'owner_role_change_requires_owner',
      });
      return c.json(permError, permError.statusCode as ContentfulStatusCode);
    }
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_org_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(removeMemberRoute, async c => {
  // Run membership middleware
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  // Run write access middleware
  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const { user: authUser } = getAuth(c);
  if (!authUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  const { orgId, memberId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  const isSelf = memberId === authUser.id;

  try {
    await requireOrgMemberRemoval(db, authUser.id, orgId, memberId);
  } catch (err) {
    if (isDomainError(err)) {
      return c.json(err, err.statusCode as ContentfulStatusCode);
    }
    throw err;
  }

  try {
    const orgApi = getOrgApi(c.env, c.executionCtx);

    if (isSelf) {
      await orgApi.leaveOrganization({
        headers: c.req.raw.headers,
        body: {
          organizationId: orgId,
        },
      });
    } else {
      await orgApi.removeMember({
        headers: c.req.raw.headers,
        body: {
          organizationId: orgId,
          memberIdOrEmail: memberId,
        },
      });
    }

    return c.json({ success: true as const, removed: memberId, isSelf });
  } catch (err) {
    const error = err as Error;
    console.error('Error removing org member:', error);
    if (error.message?.includes('owner') || error.message?.includes('last')) {
      const ownerError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'cannot_remove_last_owner',
      });
      return c.json(ownerError, ownerError.statusCode as ContentfulStatusCode);
    }
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'remove_org_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(setActiveOrgRoute, async c => {
  // Run membership middleware
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const { orgId } = c.req.valid('param');

  try {
    const orgApi = getOrgApi(c.env, c.executionCtx);
    await orgApi.setActiveOrganization({
      headers: c.req.raw.headers,
      body: {
        organizationId: orgId,
      },
    });

    return c.json({ success: true as const, activeOrganizationId: orgId });
  } catch (err) {
    const error = err as Error;
    console.error('Error setting active organization:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'set_active_organization',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// Mount org-scoped project routes
orgRoutes.route('/:orgId/projects', orgProjectRoutes);

export { orgRoutes };
