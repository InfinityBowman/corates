/**
 * User routes for Hono
 * Handles user operations including search and profile management
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@/db/client.js';
import {
  projects,
  projectMembers,
  user,
  session,
  account,
  verification,
  twoFactor,
  mediaFiles,
} from '@/db/schema.js';
import { eq, desc, or, like, sql } from 'drizzle-orm';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { searchRateLimit } from '@/middleware/rateLimit.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  AUTH_ERRORS,
  USER_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import { syncMemberToDO } from '@/lib/project-sync.js';
import { getProjectDocStub } from '@/lib/project-doc-id.js';

const userRoutes = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path?.[0] || 'input';
      const message = firstIssue?.message || 'Validation failed';
      const error = createValidationError(String(field), VALIDATION_ERRORS.INVALID_INPUT.code, null);
      error.message = message;
      return c.json(error, 400);
    }
  },
});

// Apply auth middleware to all routes
userRoutes.use('*', requireAuth);

// Apply rate limiting to search endpoint
userRoutes.use('/search', searchRateLimit);

// Response schemas
const UserSearchResultSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    displayName: z.string().nullable(),
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

const ErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('UserError');

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
function maskEmail(email) {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = local.length > 2 ? local.slice(0, 2) + '***' : local + '***';
  return `${masked}@${domain}`;
}

// Search users route
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
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Validation error',
    },
  },
});

userRoutes.openapi(searchUsersRoute, async c => {
  const { user: currentUser } = getAuth(c);
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
        displayName: user.displayName,
        image: user.image,
      })
      .from(user)
      .where(
        or(
          like(sql`lower(${user.email})`, searchPattern),
          like(sql`lower(${user.name})`, searchPattern),
          like(sql`lower(${user.displayName})`, searchPattern),
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
      displayName: u.displayName,
      username: u.username,
      image: u.image,
      email: query.includes('@') ? u.email : maskEmail(u.email),
    }));

    return c.json(sanitizedResults);
  } catch (error) {
    console.error('Error searching users:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'search_users',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

// Get my projects route
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
  },
});

userRoutes.openapi(getMyProjectsRoute, async c => {
  const { user: authUser } = getAuth(c);
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

    return c.json(results);
  } catch (error) {
    console.error('Error fetching user projects:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_user_projects',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

// Get user projects by ID route
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
    403: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Forbidden',
    },
  },
});

userRoutes.openapi(getUserProjectsRoute, async c => {
  const { user: authUser } = getAuth(c);
  const { userId } = c.req.valid('param');

  if (authUser.id !== userId) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'view_other_user_projects',
    });
    return c.json(error, error.statusCode);
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

    return c.json(results);
  } catch (error) {
    console.error('Error fetching user projects:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_user_projects',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

// Delete my account route
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
  },
});

userRoutes.openapi(deleteMyAccountRoute, async c => {
  const { user: currentUser } = getAuth(c);
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

    return c.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_account',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

// Sync profile route
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
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'User not found',
    },
  },
});

userRoutes.openapi(syncProfileRoute, async c => {
  const { user: currentUser } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const [userData] = await db
      .select({
        name: user.name,
        displayName: user.displayName,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, currentUser.id))
      .limit(1);

    if (!userData) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId: currentUser.id });
      return c.json(error, error.statusCode);
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

        await projectDoc.fetch(
          new Request('https://internal/sync-member', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Request': 'true',
            },
            body: JSON.stringify({
              action: 'update',
              member: {
                userId: currentUser.id,
                name: userData.name,
                displayName: userData.displayName,
                image: userData.image,
              },
            }),
          }),
        );
        return { projectId, success: true };
      } catch (err) {
        console.error(`Failed to sync profile to project ${projectId}:`, err);
        return { projectId, success: false, error: err.message };
      }
    });

    const results = await Promise.all(syncPromises);
    const successCount = results.filter(r => r.success).length;

    return c.json({
      success: true,
      synced: successCount,
      total: userProjects.length,
    });
  } catch (error) {
    console.error('Error syncing profile:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'sync_profile',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { userRoutes };
