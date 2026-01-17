/**
 * Database routes for Hono
 * Handles database operations and migrations
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createDb } from '@/db/client.js';
import { user } from '@/db/schema.js';
import { desc } from 'drizzle-orm';
import { requireAuth } from '@/middleware/auth.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import type { Env } from '../types';

const dbRoutes = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to users endpoint
dbRoutes.use('/users', requireAuth);

// Response schemas
const UserListSchema = z
  .object({
    id: z.string(),
    username: z.string().nullable(),
    email: z.string(),
    displayName: z.string().nullable(),
    emailVerified: z.boolean(),
    createdAt: z.string(),
  })
  .openapi('DbUser');

const UsersResponseSchema = z
  .object({
    users: z.array(UserListSchema),
  })
  .openapi('UsersResponse');

const MigrationResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .openapi('MigrationResponse');

const ErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('DbError');

// List users route
const listUsersRoute = createRoute({
  method: 'get',
  path: '/users',
  tags: ['Database'],
  summary: 'List users',
  description: 'List users in the database (requires authentication)',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UsersResponseSchema,
        },
      },
      description: 'List of users',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Database error',
    },
  },
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
dbRoutes.openapi(listUsersRoute, async c => {
  const db = createDb(c.env.DB);

  try {
    const results = await db
      .select({
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(20);

    return c.json({ users: results });
  } catch (error) {
    console.error('Error fetching users:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_users',
      originalError: error instanceof Error ? error.message : String(error),
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// Create user route (redirect to auth)
const createUserRoute = createRoute({
  method: 'post',
  path: '/users',
  tags: ['Database'],
  summary: 'Create user (deprecated)',
  description: 'This endpoint is deprecated. Use /api/auth/sign-up instead.',
  responses: {
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Use auth register endpoint',
    },
  },
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
dbRoutes.openapi(createUserRoute, c => {
  const error = createValidationError(
    'endpoint',
    VALIDATION_ERRORS.INVALID_INPUT.code,
    null,
    'use_auth_register',
  );
  return c.json(error, error.statusCode as ContentfulStatusCode);
});

// Check migration status route
const checkMigrationRoute = createRoute({
  method: 'post',
  path: '/migrate',
  tags: ['Database'],
  summary: 'Check migration status',
  description: 'Check if database migrations have been applied',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MigrationResponseSchema,
        },
      },
      description: 'Migration status',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Database error',
    },
  },
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
dbRoutes.openapi(checkMigrationRoute, async c => {
  try {
    const tableCheck = await c.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user'",
    ).first();

    if (!tableCheck) {
      return c.json({
        success: false,
        message: 'Please run: pnpm db:migrate in the workers directory',
      });
    }

    return c.json({ success: true, message: 'Migration completed' });
  } catch (error) {
    console.error('Migration error:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'check_migration',
      originalError: error instanceof Error ? error.message : String(error),
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

export { dbRoutes };
