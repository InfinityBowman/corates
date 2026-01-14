/**
 * Avatar routes for Hono
 * Handle profile picture upload/download via R2 storage
 *
 * Avatars are stored with keys: avatars/{userId}/{filename}
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, getAuth } from '@/middleware/auth';
import {
  createDomainError,
  createValidationError,
  FILE_ERRORS,
  VALIDATION_ERRORS,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import { FILE_SIZE_LIMITS } from '@/config/constants';
import { createDb } from '@/db/client';
import { projectMembers, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getProjectDocStub } from '@/lib/project-doc-id';
import type { Env } from '../types';

const avatarRoutes = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path?.[0] || 'input';
      const message = firstIssue?.message || 'Validation failed';
      const error = createValidationError(
        String(field),
        VALIDATION_ERRORS.INVALID_INPUT.code,
        null,
      );
      error.message = message;
      return c.json(error, 400);
    }
  },
});

// Apply auth middleware to all routes
avatarRoutes.use('*', requireAuth);

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Response schemas
const AvatarUploadSuccessSchema = z
  .object({
    success: z.literal(true),
    url: z.string().openapi({ example: '/api/users/avatar/user123?t=1705312800000' }),
    key: z.string().openapi({ example: 'avatars/user123/1705312800000.jpg' }),
  })
  .openapi('AvatarUploadSuccess');

const AvatarDeleteSuccessSchema = z
  .object({
    success: z.literal(true),
    message: z.string().openapi({ example: 'Avatar deleted' }),
  })
  .openapi('AvatarDeleteSuccess');

const AvatarErrorSchema = z
  .object({
    code: z.string().openapi({ example: 'FILE_TOO_LARGE' }),
    message: z.string().openapi({ example: 'Avatar size exceeds limit' }),
    statusCode: z.number().openapi({ example: 400 }),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('AvatarError');

/**
 * Sync avatar URL to all project memberships for a user
 */
async function syncAvatarToProjects(env: Env, userId: string, avatarUrl: string): Promise<void> {
  try {
    const db = createDb(env.DB);

    const memberships = await db
      .select({
        projectId: projectMembers.projectId,
        orgId: projects.orgId,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));

    for (const { projectId } of memberships) {
      try {
        const projectDoc = getProjectDocStub(env, projectId);

        await projectDoc.fetch(
          new Request('https://internal/sync-member', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Request': 'true',
            },
            body: JSON.stringify({
              action: 'update',
              member: { userId, image: avatarUrl },
            }),
          }),
        );
      } catch (err) {
        console.error(`Failed to sync avatar to project ${projectId}:`, err);
      }
    }
  } catch (err) {
    console.error('Failed to sync avatar to projects:', err);
  }
}

// Upload avatar route
const uploadAvatarRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Avatar'],
  summary: 'Upload avatar',
  description: 'Upload a new avatar image. Accepts JPEG, PNG, GIF, or WebP formats.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            avatar: z.any().openapi({ type: 'string', format: 'binary' }),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AvatarUploadSuccessSchema,
        },
      },
      description: 'Avatar uploaded successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: AvatarErrorSchema,
        },
      },
      description: 'Invalid file type or size',
    },
    401: {
      content: {
        'application/json': {
          schema: AvatarErrorSchema,
        },
      },
      description: 'Unauthorized',
    },
    500: {
      content: {
        'application/json': {
          schema: AvatarErrorSchema,
        },
      },
      description: 'Server error',
    },
  },
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
avatarRoutes.openapi(uploadAvatarRoute, async c => {
  const { user } = getAuth(c);
  if (!user) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  // Check Content-Length header first for early rejection
  const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);
  if (contentLength > FILE_SIZE_LIMITS.AVATAR) {
    const error = createDomainError(
      FILE_ERRORS.TOO_LARGE,
      { fileSize: contentLength, maxSize: FILE_SIZE_LIMITS.AVATAR },
      `Avatar size exceeds limit of ${FILE_SIZE_LIMITS.AVATAR / (1024 * 1024)}MB`,
    );
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  try {
    const contentType = c.req.header('Content-Type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('avatar');

      if (!file || !(file instanceof File)) {
        const error = createDomainError(
          VALIDATION_ERRORS.FIELD_REQUIRED,
          { field: 'avatar' },
          'No avatar file provided',
        );
        return c.json(error, error.statusCode as ContentfulStatusCode);
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        const error = createDomainError(
          FILE_ERRORS.INVALID_TYPE,
          { fileType: file.type, allowedTypes: ALLOWED_TYPES },
          'Invalid file type. Allowed: JPEG, PNG, GIF, WebP',
        );
        return c.json(error, error.statusCode as ContentfulStatusCode);
      }

      if (file.size > FILE_SIZE_LIMITS.AVATAR) {
        const error = createDomainError(
          FILE_ERRORS.TOO_LARGE,
          { fileSize: file.size, maxSize: FILE_SIZE_LIMITS.AVATAR },
          `Avatar size exceeds limit of ${FILE_SIZE_LIMITS.AVATAR / (1024 * 1024)}MB`,
        );
        return c.json(error, error.statusCode as ContentfulStatusCode);
      }

      const ext = file.type.split('/')[1] || 'jpg';
      const timestamp = Date.now();
      const key = `avatars/${user.id}/${timestamp}.${ext}`;

      // Delete old avatar if exists
      try {
        const oldAvatars = await c.env.PDF_BUCKET.list({ prefix: `avatars/${user.id}/` });
        for (const obj of oldAvatars.objects) {
          await c.env.PDF_BUCKET.delete(obj.key);
        }
      } catch (e) {
        console.warn('Failed to delete old avatar:', e);
      }

      // Upload new avatar to R2
      const arrayBuffer = await file.arrayBuffer();
      await c.env.PDF_BUCKET.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=31536000',
        },
        customMetadata: {
          userId: user.id,
          uploadedAt: new Date().toISOString(),
        },
      });

      const avatarUrl = `/api/users/avatar/${user.id}?t=${timestamp}`;
      await syncAvatarToProjects(c.env, user.id, avatarUrl);

      return c.json({
        success: true as const,
        url: avatarUrl,
        key,
      });
    }

    const error = createDomainError(
      VALIDATION_ERRORS.FIELD_INVALID_FORMAT,
      { field: 'Content-Type' },
      'Invalid content type',
    );
    return c.json(error, error.statusCode as ContentfulStatusCode);
  } catch (err) {
    const error = err as Error;
    console.error('Avatar upload error:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'upload_avatar',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// Get avatar route
const getAvatarRoute = createRoute({
  method: 'get',
  path: '/{userId}',
  tags: ['Avatar'],
  summary: 'Get user avatar',
  description: "Retrieves a user's avatar image",
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      userId: z.string().openapi({ example: 'user123' }),
    }),
  },
  responses: {
    200: {
      content: {
        'image/jpeg': {
          schema: z.any().openapi({ type: 'string', format: 'binary' }),
        },
        'image/png': {
          schema: z.any().openapi({ type: 'string', format: 'binary' }),
        },
        'image/gif': {
          schema: z.any().openapi({ type: 'string', format: 'binary' }),
        },
        'image/webp': {
          schema: z.any().openapi({ type: 'string', format: 'binary' }),
        },
      },
      description: 'Avatar image',
    },
    404: {
      content: {
        'application/json': {
          schema: AvatarErrorSchema,
        },
      },
      description: 'Avatar not found',
    },
    500: {
      content: {
        'application/json': {
          schema: AvatarErrorSchema,
        },
      },
      description: 'Server error',
    },
  },
});

avatarRoutes.openapi(getAvatarRoute, async c => {
  const { userId } = c.req.valid('param');

  try {
    const listed = await c.env.PDF_BUCKET.list({ prefix: `avatars/${userId}/` });

    if (listed.objects.length === 0) {
      const error = createDomainError(FILE_ERRORS.NOT_FOUND, { fileName: 'avatar' });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const avatarKey = listed.objects[0].key;
    const object = await c.env.PDF_BUCKET.get(avatarKey);

    if (!object) {
      const error = createDomainError(FILE_ERRORS.NOT_FOUND, { fileName: 'avatar' });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000');
    headers.set('ETag', object.etag);

    return new Response(object.body, { headers });
  } catch (err) {
    const error = err as Error;
    console.error('Avatar fetch error:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_avatar',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

// Delete avatar route
const deleteAvatarRoute = createRoute({
  method: 'delete',
  path: '/',
  tags: ['Avatar'],
  summary: 'Delete avatar',
  description: "Deletes the current user's avatar",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AvatarDeleteSuccessSchema,
        },
      },
      description: 'Avatar deleted successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: AvatarErrorSchema,
        },
      },
      description: 'Unauthorized',
    },
    500: {
      content: {
        'application/json': {
          schema: AvatarErrorSchema,
        },
      },
      description: 'Server error',
    },
  },
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
avatarRoutes.openapi(deleteAvatarRoute, async c => {
  const { user } = getAuth(c);
  if (!user) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  }

  try {
    const listed = await c.env.PDF_BUCKET.list({ prefix: `avatars/${user.id}/` });

    for (const obj of listed.objects) {
      await c.env.PDF_BUCKET.delete(obj.key);
    }

    return c.json({ success: true as const, message: 'Avatar deleted' });
  } catch (err) {
    const error = err as Error;
    console.error('Avatar delete error:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_avatar',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

export { avatarRoutes };
