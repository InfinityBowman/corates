/**
 * User routes for Hono
 * Handles user operations including search and profile management
 */

import { OpenAPIHono, createRoute, z, $ } from '@hono/zod-openapi';

import { createDb } from '@/db/client';
import {
  projects,
  projectMembers,
  user,
  session,
  account,
  verification,
  twoFactor,
  mediaFiles,
} from '@/db/schema';
import { eq, desc, or, like, sql } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth';
import { searchRateLimit } from '@/middleware/rateLimit';
import { createDomainError, AUTH_ERRORS, USER_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { syncMemberToDO } from '@/lib/project-sync';
import { getProjectDocStub } from '@/lib/project-doc-id';
import { validationHook } from '@/lib/honoValidationHook';
import type { Env } from '../types';
import { ErrorResponseSchema } from '@/schemas/common.js';

const base = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

// Apply auth middleware to all routes, rate limiting to search
base.use('*', requireAuth);
base.use('/search', searchRateLimit);

// Response schemas
const UserSearchResultSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    givenName: z.string().nullable(),
    familyName: z.string().nullable(),
    username: z.string().nullable(),
    image: z.string().nullable(),
    email: z.string().nullable(),
  })
  .openapi('UserSearchResult');

const UserProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    orgId: z.string(),
    role: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('UserProject');

const SuccessSchema = z
  .object({
    success: z.literal(true),
    message: z.string().optional(),
  })
  .openapi('UserSuccess');

const SyncResultSchema = z
  .object({
    success: z.literal(true),
    synced: z.number(),
    total: z.number(),
  })
  .openapi('SyncResult');

/**
 * Mask email for privacy (show first 2 chars and domain)
 */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = local.length > 2 ? local.slice(0, 2) + '***' : local + '***';
  return `${masked}@${domain}`;
}

// Route definitions
const searchUsersRoute = createRoute({
  method: 'get',
  path: '/search',
  tags: ['Users'],
  summary: 'Search users',
  description: 'Search users by name or email. Requires minimum 2 character query.',
  security: [{ cookieAuth: [] }],
  request: {
    query: z.object({
      q: z.string().min(2).openapi({ example: 'john' }),
      projectId: z.string().optional().openapi({ example: 'proj-123' }),
      limit: z.coerce
        .number()
        .default(10)
        .transform(n => Math.min(n, 20))
        .openapi({ example: 10 }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(UserSearchResultSchema),
        },
      },
      description: 'Search results',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Database error',
    },
  },
});

const getMyProjectsRoute = createRoute({
  method: 'get',
  path: '/me/projects',
  tags: ['Users'],
  summary: 'Get my projects',
  description: 'Get all projects for the current authenticated user',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(UserProjectSchema),
        },
      },
      description: 'User projects',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Database error',
    },
  },
});

const getUserProjectsRoute = createRoute({
  method: 'get',
  path: '/{userId}/projects',
  tags: ['Users'],
  summary: 'Get user projects',
  description: 'Get all projects for a user (only accessible by the user themselves)',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      userId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(UserProjectSchema),
        },
      },
      description: 'User projects',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Forbidden',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Database error',
    },
  },
});

const deleteMyAccountRoute = createRoute({
  method: 'delete',
  path: '/me',
  tags: ['Users'],
  summary: 'Delete my account',
  description: "Delete current user's account and all associated data",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessSchema,
        },
      },
      description: 'Account deleted successfully',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Database error',
    },
  },
});

const syncProfileRoute = createRoute({
  method: 'post',
  path: '/sync-profile',
  tags: ['Users'],
  summary: 'Sync profile to projects',
  description: "Sync the current user's profile changes to all their project memberships",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SyncResultSchema,
        },
      },
      description: 'Profile synced successfully',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'User not found',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Database error',
    },
  },
});

// Route handlers - chained for RPC type inference
const userRoutes = $(base)

.openapi(searchUsersRoute, async c => {
  const { user: currentUser } = getAuth(c);
  if (!currentUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, 401);
  }

  const { q: query, projectId, limit } = c.req.valid('query');

  const db = createDb(c.env.DB);
  const searchPattern = `%${query.toLowerCase()}%`;

  try {
    let results = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        givenName: user.givenName,
        familyName: user.familyName,
        image: user.image,
      })
      .from(user)
      .where(
        or(
          like(sql`lower(${user.email})`, searchPattern),
          like(sql`lower(${user.name})`, searchPattern),
          like(sql`lower(${user.givenName})`, searchPattern),
          like(sql`lower(${user.familyName})`, searchPattern),
          like(sql`lower(${user.username})`, searchPattern),
        ),
      )
      .limit(limit);

    if (projectId) {
      const existingMembers = await db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, projectId));

      const existingUserIds = new Set(existingMembers.map(m => m.userId));
      results = results.filter(u => !existingUserIds.has(u.id));
    }

    results = results.filter(u => u.id !== currentUser.id);

    const sanitizedResults = results.map(u => ({
      id: u.id,
      name: u.name,
      givenName: u.givenName,
      familyName: u.familyName,
      username: u.username,
      image: u.image,
      email: query.includes('@') ? u.email : maskEmail(u.email),
    }));

    return c.json(sanitizedResults, 200);
  } catch (err) {
    const error = err as Error;
    console.error('Error searching users:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'search_users',
      originalError: error.message,
    });
    return c.json(dbError, 500);
  }
})

.openapi(getMyProjectsRoute, async c => {
  const { user: authUser } = getAuth(c);
  if (!authUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, 401);
  }

  const db = createDb(c.env.DB);

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
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, authUser.id))
      .orderBy(desc(projects.updatedAt));

    return c.json(results as unknown as z.infer<typeof UserProjectSchema>[], 200);
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching user projects:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_user_projects',
      originalError: error.message,
    });
    return c.json(dbError, 500);
  }
})

.openapi(getUserProjectsRoute, async c => {
  const { user: authUser } = getAuth(c);
  if (!authUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, 401);
  }

  const { userId } = c.req.valid('param');

  if (authUser.id !== userId) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'view_other_user_projects',
    });
    return c.json(error, 403);
  }

  const db = createDb(c.env.DB);

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
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, userId))
      .orderBy(desc(projects.updatedAt));

    return c.json(results as unknown as z.infer<typeof UserProjectSchema>[], 200);
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching user projects:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_user_projects',
      originalError: error.message,
    });
    return c.json(dbError, 500);
  }
})

.openapi(deleteMyAccountRoute, async c => {
  const { user: currentUser } = getAuth(c);
  if (!currentUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, 401);
  }

  const db = createDb(c.env.DB);
  const userId = currentUser.id;

  try {
    const userProjects = await db
      .select({
        projectId: projectMembers.projectId,
        orgId: projects.orgId,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));

    await Promise.all(
      userProjects.map(({ projectId }) => syncMemberToDO(c.env, projectId, 'remove', { userId })),
    );

    await db.batch([
      db.update(mediaFiles).set({ uploadedBy: null }).where(eq(mediaFiles.uploadedBy, userId)),
      db.delete(projectMembers).where(eq(projectMembers.userId, userId)),
      db.delete(projects).where(eq(projects.createdBy, userId)),
      db.delete(twoFactor).where(eq(twoFactor.userId, userId)),
      db.delete(session).where(eq(session.userId, userId)),
      db.delete(account).where(eq(account.userId, userId)),
      db.delete(verification).where(eq(verification.identifier, currentUser.email)),
      db.delete(user).where(eq(user.id, userId)),
    ]);

    console.log(`Account deleted successfully for user: ${userId}`);

    return c.json({ success: true as const, message: 'Account deleted successfully' }, 200);
  } catch (err) {
    const error = err as Error;
    console.error('Error deleting account:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_account',
      originalError: error.message,
    });
    return c.json(dbError, 500);
  }
})

.openapi(syncProfileRoute, async c => {
  const { user: currentUser } = getAuth(c);
  if (!currentUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, 401);
  }

  const db = createDb(c.env.DB);

  try {
    const [userData] = await db
      .select({
        name: user.name,
        givenName: user.givenName,
        familyName: user.familyName,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, currentUser.id))
      .limit(1);

    if (!userData) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId: currentUser.id });
      return c.json(error, 404);
    }

    const userProjects = await db
      .select({
        projectId: projectMembers.projectId,
        orgId: projects.orgId,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, currentUser.id));

    const syncPromises = userProjects.map(async ({ projectId }) => {
      try {
        const projectDoc = getProjectDocStub(c.env, projectId);

        await projectDoc.syncMember('update', {
          userId: currentUser.id,
          name: userData.name,
          givenName: userData.givenName,
          familyName: userData.familyName,
          image: userData.image,
        });
        return { projectId, success: true };
      } catch (err) {
        const error = err as Error;
        console.error(`Failed to sync profile to project ${projectId}:`, err);
        return { projectId, success: false, error: error.message };
      }
    });

    const results = await Promise.all(syncPromises);
    const successCount = results.filter(r => r.success).length;

    return c.json(
      {
        success: true as const,
        synced: successCount,
        total: userProjects.length,
      },
      200,
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error syncing profile:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'sync_profile',
      originalError: error.message,
    });
    return c.json(dbError, 500);
  }
});

export { userRoutes };
export type UserRoutes = typeof userRoutes;
