/**
 * Admin user management routes
 * Handles user CRUD operations, bans, impersonation, subscriptions, and stats
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createDb } from '@/db/client.js';
import {
  user,
  session,
  projects,
  projectMembers,
  account,
  verification,
  twoFactor,
  mediaFiles,
  member,
  organization,
} from '@/db/schema.js';
import { eq, desc, sql, like, or, count } from 'drizzle-orm';
import { resolveOrgAccess } from '@/lib/billingResolver.js';
import { getPlan, getGrantPlan, type GrantType } from '@corates/shared/plans';
import { createAuth } from '@/auth/config.js';
import {
  createDomainError,
  createValidationError,
  USER_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { TIME_DURATIONS } from '@/config/constants.js';
import { syncMemberToDO } from '@/lib/project-sync.js';
import { validationHook } from '@/lib/honoValidationHook.js';
import type { Env, AuthUser, AppVariables } from '../../types';

const userRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>({
  defaultHook: validationHook,
});

// Response schemas
const StatsResponseSchema = z
  .object({
    users: z.number(),
    projects: z.number(),
    activeSessions: z.number(),
    recentSignups: z.number(),
  })
  .openapi('AdminStatsResponse');

const UserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    displayName: z.string().nullable(),
    username: z.string().nullable(),
    image: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    role: z.string().nullable(),
    emailVerified: z.boolean().nullable(),
    banned: z.boolean().nullable(),
    banReason: z.string().nullable(),
    banExpires: z.union([z.string(), z.date(), z.number()]).nullable(),
    stripeCustomerId: z.string().nullable(),
    createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    updatedAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    providers: z.array(z.string()).optional(),
  })
  .openapi('AdminUser');

const UserListResponseSchema = z
  .object({
    users: z.array(UserSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  })
  .openapi('AdminUserListResponse');

const UserProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    role: z.string().nullable(),
    joinedAt: z.union([z.string(), z.date(), z.number()]).nullable(),
  })
  .openapi('UserProject');

const UserSessionSchema = z
  .object({
    id: z.string(),
    createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    expiresAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
  })
  .openapi('UserSession');

const LinkedAccountSchema = z
  .object({
    id: z.string(),
    providerId: z.string(),
    accountId: z.string(),
    createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
  })
  .openapi('LinkedAccount');

const OrgMembershipSchema = z
  .object({
    orgId: z.string(),
    orgName: z.string(),
    orgSlug: z.string().nullable(),
    role: z.string(),
    membershipCreatedAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    billing: z.object({
      effectivePlanId: z.string(),
      source: z.string(),
      accessMode: z.string(),
      planName: z.string(),
    }),
  })
  .openapi('OrgMembership');

const UserDetailsResponseSchema = z
  .object({
    user: z.record(z.string(), z.unknown()),
    projects: z.array(UserProjectSchema),
    sessions: z.array(UserSessionSchema),
    accounts: z.array(LinkedAccountSchema),
    orgs: z.array(OrgMembershipSchema),
  })
  .openapi('AdminUserDetailsResponse');

const BanUserRequestSchema = z
  .object({
    reason: z.string().optional().openapi({ example: 'Violation of terms of service' }),
    expiresAt: z
      .string()
      .datetime()
      .optional()
      .nullable()
      .openapi({ example: '2025-12-31T23:59:59Z' }),
  })
  .openapi('BanUserRequest');

const ImpersonateUserRequestSchema = z
  .object({
    userId: z.string().min(1, 'userId is required').openapi({ example: 'user-123' }),
  })
  .openapi('ImpersonateUserRequest');

const SuccessResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .openapi('SuccessResponse');

const AdminErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('AdminUserError');

// Route definitions
const getStatsRoute = createRoute({
  method: 'get',
  path: '/stats',
  tags: ['Admin - Users'],
  summary: 'Get dashboard statistics',
  description: 'Get admin dashboard statistics including user, project, and session counts.',
  responses: {
    200: {
      description: 'Dashboard statistics',
      content: {
        'application/json': {
          schema: StatsResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
  },
});

const listUsersRoute = createRoute({
  method: 'get',
  path: '/users',
  tags: ['Admin - Users'],
  summary: 'List all users',
  description: 'List all users with pagination and search.',
  request: {
    query: z.object({
      page: z.string().optional().openapi({ description: 'Page number', example: '1' }),
      limit: z
        .string()
        .optional()
        .openapi({ description: 'Results per page (max 100)', example: '20' }),
      search: z
        .string()
        .optional()
        .openapi({ description: 'Search by email, name, displayName, or username' }),
    }),
  },
  responses: {
    200: {
      description: 'List of users',
      content: {
        'application/json': {
          schema: UserListResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
  },
});

const getUserDetailsRoute = createRoute({
  method: 'get',
  path: '/users/{userId}',
  tags: ['Admin - Users'],
  summary: 'Get user details',
  description:
    'Get detailed user info including projects, sessions, accounts, and org memberships.',
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'User ID', example: 'user-123' }),
    }),
  },
  responses: {
    200: {
      description: 'User details',
      content: {
        'application/json': {
          schema: UserDetailsResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
  },
});

const banUserRoute = createRoute({
  method: 'post',
  path: '/users/{userId}/ban',
  tags: ['Admin - Users'],
  summary: 'Ban a user',
  description: 'Ban a user and invalidate all their sessions.',
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'User ID to ban', example: 'user-123' }),
    }),
    body: {
      required: false,
      content: {
        'application/json': {
          schema: BanUserRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User banned successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    400: {
      description: 'Cannot ban yourself',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
  },
});

const unbanUserRoute = createRoute({
  method: 'post',
  path: '/users/{userId}/unban',
  tags: ['Admin - Users'],
  summary: 'Unban a user',
  description: 'Remove ban from a user.',
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'User ID to unban', example: 'user-123' }),
    }),
  },
  responses: {
    200: {
      description: 'User unbanned successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
  },
});

const impersonateUserRoute = createRoute({
  method: 'post',
  path: '/users/{userId}/impersonate',
  tags: ['Admin - Users'],
  summary: 'Impersonate a user',
  description: 'Start impersonating a user (creates a new session).',
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'User ID to impersonate', example: 'user-123' }),
    }),
    body: {
      required: true,
      content: {
        'application/json': {
          schema: ImpersonateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Impersonation started',
      content: {
        'application/json': {
          schema: z.record(z.string(), z.unknown()),
        },
      },
    },
    400: {
      description: 'Cannot impersonate yourself',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
  },
});

const revokeAllSessionsRoute = createRoute({
  method: 'delete',
  path: '/users/{userId}/sessions',
  tags: ['Admin - Users'],
  summary: 'Revoke all sessions',
  description: 'Revoke all sessions for a user.',
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'User ID', example: 'user-123' }),
    }),
  },
  responses: {
    200: {
      description: 'All sessions revoked',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
  },
});

const revokeSessionRoute = createRoute({
  method: 'delete',
  path: '/users/{userId}/sessions/{sessionId}',
  tags: ['Admin - Users'],
  summary: 'Revoke a session',
  description: 'Revoke a specific session for a user.',
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'User ID', example: 'user-123' }),
      sessionId: z.string().openapi({ description: 'Session ID', example: 'session-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Session revoked',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    404: {
      description: 'Session not found',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
  },
});

const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/users/{userId}',
  tags: ['Admin - Users'],
  summary: 'Delete a user',
  description: 'Delete a user and all their data.',
  request: {
    params: z.object({
      userId: z.string().openapi({ description: 'User ID to delete', example: 'user-123' }),
    }),
  },
  responses: {
    200: {
      description: 'User deleted successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    400: {
      description: 'Cannot delete yourself',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
  },
});

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
userRoutes.openapi(getStatsRoute, async c => {
  const db = createDb(c.env.DB);

  try {
    // Get counts in parallel
    const [userCount, projectCount, sessionCount] = await Promise.all([
      db.select({ count: count() }).from(user),
      db.select({ count: count() }).from(projects),
      db.select({ count: count() }).from(session),
    ]);

    // Get recent signups (last 7 days)
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - TIME_DURATIONS.STATS_RECENT_DAYS_SEC;
    const [recentSignups] = await db
      .select({ count: count() })
      .from(user)
      .where(sql`${user.createdAt} > ${sevenDaysAgo}`);

    return c.json({
      users: userCount[0]?.count || 0,
      projects: projectCount[0]?.count || 0,
      activeSessions: sessionCount[0]?.count || 0,
      recentSignups: recentSignups?.count || 0,
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching admin stats:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_admin_stats',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * GET /api/admin/users
 * List all users with pagination and search
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
userRoutes.openapi(listUsersRoute, async c => {
  const db = createDb(c.env.DB);
  const query = c.req.valid('query');

  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const search = query.search?.trim();
  const offset = (page - 1) * limit;

  try {
    // Build search condition
    const searchCondition =
      search ?
        or(
          like(sql`lower(${user.email})`, `%${search.toLowerCase()}%`),
          like(sql`lower(${user.name})`, `%${search.toLowerCase()}%`),
          like(sql`lower(${user.displayName})`, `%${search.toLowerCase()}%`),
          like(sql`lower(${user.username})`, `%${search.toLowerCase()}%`),
        )
      : undefined;

    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: count() })
      .from(user)
      .where(searchCondition);

    // Get paginated results with or without search
    const selectFields = {
      id: user.id,
      name: user.name,
      email: user.email,
      displayName: user.displayName,
      username: user.username,
      image: user.image,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      stripeCustomerId: user.stripeCustomerId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const users =
      searchCondition ?
        await db
          .select(selectFields)
          .from(user)
          .where(searchCondition)
          .orderBy(desc(user.createdAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select(selectFields)
          .from(user)
          .orderBy(desc(user.createdAt))
          .limit(limit)
          .offset(offset);

    // Fetch linked accounts for all users in the result set
    const userIds = users.map(u => u.id);
    let accountsMap: Record<string, string[]> = {};

    if (userIds.length > 0) {
      const accounts = await db
        .select({
          userId: account.userId,
          providerId: account.providerId,
        })
        .from(account)
        .where(
          sql`${account.userId} IN (${sql.join(
            userIds.map(id => sql`${id}`),
            sql`, `,
          )})`,
        );

      // Group accounts by userId
      accountsMap = accounts.reduce(
        (acc, a) => {
          if (!acc[a.userId]) acc[a.userId] = [];
          acc[a.userId].push(a.providerId);
          return acc;
        },
        {} as Record<string, string[]>,
      );
    }

    // Merge providers into user objects
    const usersWithProviders = users.map(u => ({
      ...u,
      providers: accountsMap[u.id] || [],
    }));

    return c.json({
      users: usersWithProviders,
      pagination: {
        page,
        limit,
        total: totalResult?.count || 0,
        totalPages: Math.ceil((totalResult?.count || 0) / limit),
      },
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching users:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_users',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * GET /api/admin/users/:userId
 * Get detailed user info
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
userRoutes.openapi(getUserDetailsRoute, async c => {
  const { userId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  try {
    const [userData] = await db.select().from(user).where(eq(user.id, userId)).limit(1);

    if (!userData) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Get user's projects
    const userProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        role: projectMembers.role,
        joinedAt: projectMembers.joinedAt,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));

    // Get user's active sessions
    const userSessions = await db
      .select({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, userId))
      .orderBy(desc(session.createdAt));

    // Get user's linked accounts
    const linkedAccounts = await db
      .select({
        id: account.id,
        providerId: account.providerId,
        accountId: account.accountId,
        createdAt: account.createdAt,
      })
      .from(account)
      .where(eq(account.userId, userId))
      .orderBy(desc(account.createdAt));

    // Get org memberships with billing info
    const orgMemberships = await db
      .select({
        orgId: member.organizationId,
        role: member.role,
        createdAt: member.createdAt,
        orgName: organization.name,
        orgSlug: organization.slug,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, userId))
      .orderBy(desc(member.createdAt));

    // Get billing info for each org
    const orgsWithBilling = await Promise.all(
      orgMemberships.map(async membership => {
        const orgBilling = await resolveOrgAccess(db, membership.orgId);
        const effectivePlan =
          orgBilling.source === 'grant' ?
            getGrantPlan(orgBilling.effectivePlanId as GrantType)
          : getPlan(orgBilling.effectivePlanId);

        return {
          orgId: membership.orgId,
          orgName: membership.orgName,
          orgSlug: membership.orgSlug,
          role: membership.role,
          membershipCreatedAt: membership.createdAt,
          billing: {
            effectivePlanId: orgBilling.effectivePlanId,
            source: orgBilling.source,
            accessMode: orgBilling.accessMode,
            planName: effectivePlan.name,
          },
        };
      }),
    );

    return c.json({
      user: userData,
      projects: userProjects,
      sessions: userSessions,
      accounts: linkedAccounts,
      orgs: orgsWithBilling,
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching user details:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_user_details',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * POST /api/admin/users/:userId/ban
 * Ban a user
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
userRoutes.openapi(banUserRoute, async c => {
  const { userId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  // Get body if provided (it's optional)
  let reason: string | undefined;
  let expiresAt: Date | null = null;
  try {
    const body = await c.req.json();
    reason = body?.reason;
    expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
  } catch {
    // No body provided, use defaults
  }

  try {
    // Don't allow banning yourself
    const adminUser = c.get('user') as AuthUser;
    if (adminUser.id === userId) {
      const error = createValidationError(
        'userId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        userId,
        'cannot_ban_self',
      );
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Ban user and invalidate sessions atomically
    await db.batch([
      db
        .update(user)
        .set({
          banned: true,
          banReason: reason || 'Banned by administrator',
          banExpires: expiresAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId)),
      db.delete(session).where(eq(session.userId, userId)),
    ]);

    return c.json({ success: true, message: 'User banned successfully' });
  } catch (err) {
    const error = err as Error;
    console.error('Error banning user:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'ban_user',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * POST /api/admin/users/:userId/unban
 * Unban a user
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
userRoutes.openapi(unbanUserRoute, async c => {
  const { userId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  try {
    await db
      .update(user)
      .set({
        banned: false,
        banReason: null,
        banExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return c.json({ success: true, message: 'User unbanned successfully' });
  } catch (err) {
    const error = err as Error;
    console.error('Error unbanning user:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'unban_user',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * POST /api/admin/users/:userId/impersonate
 * Start impersonating a user (creates a new session)
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
userRoutes.openapi(impersonateUserRoute, async c => {
  const { userId } = c.req.valid('param');
  const adminUser = c.get('user') as AuthUser;
  const body = c.req.valid('json');

  try {
    // Don't allow impersonating yourself
    if (adminUser.id === userId) {
      const error = createValidationError(
        'userId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        userId,
        'cannot_impersonate_self',
      );
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Use Better Auth's handler for impersonation to properly handle cookies
    const auth = createAuth(c.env, c.executionCtx);
    const url = new URL(c.req.url);

    // Create a request to Better Auth's impersonation endpoint
    const authUrl = new URL('/api/auth/admin/impersonate-user', url.origin);
    const cookie = c.req.raw.headers.get('cookie');
    const origin = c.req.raw.headers.get('origin');
    const referer = c.req.raw.headers.get('referer');
    const headers = new Headers();
    if (cookie) headers.set('cookie', cookie);
    if (origin) headers.set('origin', origin);
    if (referer) headers.set('referer', referer);
    headers.set('content-type', 'application/json');
    headers.set('accept', 'application/json');
    const authRequest = new Request(authUrl.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: body.userId }),
    });

    // Let Better Auth handle the request (this properly sets cookies)
    const response = await auth.handler(authRequest);

    if (response.status === 403 && c.env.ENVIRONMENT !== 'production') {
      try {
        const respBody = await response.clone().text();
        console.log('[Admin] Impersonation forbidden:', respBody);
      } catch {
        // ignore
      }
    }

    return response;
  } catch (err) {
    const error = err as Error;
    console.error('Error impersonating user:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'impersonate_user',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * DELETE /api/admin/users/:userId/sessions
 * Revoke all sessions for a user
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
userRoutes.openapi(revokeAllSessionsRoute, async c => {
  const { userId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  try {
    await db.delete(session).where(eq(session.userId, userId));

    return c.json({ success: true, message: 'All sessions revoked' });
  } catch (err) {
    const error = err as Error;
    console.error('Error revoking sessions:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'revoke_sessions',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * DELETE /api/admin/users/:userId/sessions/:sessionId
 * Revoke a specific session for a user
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
userRoutes.openapi(revokeSessionRoute, async c => {
  const { userId, sessionId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  try {
    // Verify the session belongs to the user
    const [existingSession] = await db
      .select({ id: session.id, userId: session.userId })
      .from(session)
      .where(eq(session.id, sessionId))
      .limit(1);

    if (!existingSession) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { sessionId });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Verify session belongs to the specified user
    if (existingSession.userId !== userId) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { sessionId });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    await db.delete(session).where(eq(session.id, sessionId));

    return c.json({ success: true, message: 'Session revoked' });
  } catch (err) {
    const error = err as Error;
    console.error('Error revoking session:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'revoke_session',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user and all their data
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
userRoutes.openapi(deleteUserRoute, async c => {
  const { userId } = c.req.valid('param');
  const adminUser = c.get('user') as AuthUser;
  const db = createDb(c.env.DB);

  try {
    // Don't allow deleting yourself
    if (adminUser.id === userId) {
      const error = createValidationError(
        'userId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        userId,
        'cannot_delete_self',
      );
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Fetch user to get email for verification cleanup
    const [userToDelete] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId));
    if (!userToDelete) {
      const error = createDomainError(USER_ERRORS.NOT_FOUND, { userId });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Fetch all projects the user is a member of before any deletions (with orgId)
    const userProjects = await db
      .select({
        projectId: projectMembers.projectId,
        orgId: projects.orgId,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));

    // Sync all member removals to DOs atomically (fail fast if any fails)
    await Promise.all(
      userProjects.map(({ projectId }) => syncMemberToDO(c.env, projectId, 'remove', { userId })),
    );

    // Only proceed with database deletions if all DO syncs succeeded
    // Delete all user data atomically using batch transaction
    await db.batch([
      db.update(mediaFiles).set({ uploadedBy: null }).where(eq(mediaFiles.uploadedBy, userId)),
      db.delete(projectMembers).where(eq(projectMembers.userId, userId)),
      db.delete(projects).where(eq(projects.createdBy, userId)),
      db.delete(twoFactor).where(eq(twoFactor.userId, userId)),
      db.delete(session).where(eq(session.userId, userId)),
      db.delete(account).where(eq(account.userId, userId)),
      db.delete(verification).where(eq(verification.identifier, userToDelete.email)),
      db.delete(user).where(eq(user.id, userId)),
    ]);

    return c.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    const error = err as Error;
    console.error('Error deleting user:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_user',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

export { userRoutes };
