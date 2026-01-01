/**
 * Avatar routes for Hono
 * Handle profile picture upload/download via R2 storage
 *
 * Avatars are stored with keys: avatars/{userId}/{filename}
 */

import { Hono } from 'hono';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { createDomainError, FILE_ERRORS, VALIDATION_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { createDb } from '../db/client.js';
import { projectMembers, projects } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getProjectDocStub } from '../lib/project-doc-id.js';

const avatarRoutes = new Hono();

// Apply auth middleware to all routes
avatarRoutes.use('*', requireAuth);

// Maximum avatar file size (2MB - smaller than general IMAGE limit)
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Sync avatar URL to all project memberships for a user
 */
async function syncAvatarToProjects(env, userId, avatarUrl) {
  try {
    const db = createDb(env.DB);

    // Get all projects the user is a member of (with orgId for DO addressing)
    const memberships = await db
      .select({
        projectId: projectMembers.projectId,
        orgId: projects.orgId,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));

    // Update each project's Durable Object
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

/**
 * POST /api/users/avatar
 * Upload a new avatar image
 */
avatarRoutes.post('/', async c => {
  const { user } = getAuth(c);

  // Check Content-Length header first for early rejection
  const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);
  if (contentLength > MAX_AVATAR_SIZE) {
    const error = createDomainError(
      FILE_ERRORS.TOO_LARGE,
      { fileSize: contentLength, maxSize: MAX_AVATAR_SIZE },
      `Avatar size exceeds limit of ${MAX_AVATAR_SIZE / (1024 * 1024)}MB`,
    );
    return c.json(error, error.statusCode);
  }

  try {
    const contentType = c.req.header('Content-Type') || '';

    // Handle multipart form data
    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('avatar');

      if (!file || !(file instanceof File)) {
        const error = createDomainError(
          VALIDATION_ERRORS.FIELD_REQUIRED,
          { field: 'avatar' },
          'No avatar file provided',
        );
        return c.json(error, error.statusCode);
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        const error = createDomainError(
          FILE_ERRORS.INVALID_TYPE,
          { fileType: file.type, allowedTypes: ALLOWED_TYPES },
          'Invalid file type. Allowed: JPEG, PNG, GIF, WebP',
        );
        return c.json(error, error.statusCode);
      }

      // Validate file size (double-check after parsing)
      if (file.size > MAX_AVATAR_SIZE) {
        const error = createDomainError(
          FILE_ERRORS.TOO_LARGE,
          { fileSize: file.size, maxSize: MAX_AVATAR_SIZE },
          `Avatar size exceeds limit of ${MAX_AVATAR_SIZE / (1024 * 1024)}MB`,
        );
        return c.json(error, error.statusCode);
      }

      // Generate unique filename with extension
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
          cacheControl: 'public, max-age=31536000', // 1 year cache
        },
        customMetadata: {
          userId: user.id,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Generate the public URL - serve through our API
      // Use a same-origin relative URL so service workers and the browser cache
      // can treat the avatar as a first-class asset for offline usage.
      // Absolute URLs may point to a different hostname (e.g. api.corates.org) which
      // some service worker logic deliberately skips, preventing offline caching.
      // Add timestamp query parameter for cache-busting when avatar is updated
      const avatarUrl = `/api/users/avatar/${user.id}?t=${timestamp}`;

      // Sync the new avatar URL to all project memberships
      await syncAvatarToProjects(c.env, user.id, avatarUrl);

      return c.json({
        success: true,
        url: avatarUrl,
        key,
      });
    }

    const error = createDomainError(
      VALIDATION_ERRORS.FIELD_INVALID_FORMAT,
      { field: 'Content-Type' },
      'Invalid content type',
    );
    return c.json(error, error.statusCode);
  } catch (error) {
    console.error('Avatar upload error:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'upload_avatar',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/users/avatar/:userId
 * Get a user's avatar image
 */
avatarRoutes.get('/:userId', async c => {
  const userId = c.req.param('userId');

  try {
    // List avatars for this user (should only be one)
    const listed = await c.env.PDF_BUCKET.list({ prefix: `avatars/${userId}/` });

    if (listed.objects.length === 0) {
      const error = createDomainError(FILE_ERRORS.NOT_FOUND, { fileName: 'avatar' });
      return c.json(error, error.statusCode);
    }

    // Get the most recent avatar
    const avatarKey = listed.objects[0].key;
    const object = await c.env.PDF_BUCKET.get(avatarKey);

    if (!object) {
      const error = createDomainError(FILE_ERRORS.NOT_FOUND, { fileName: 'avatar' });
      return c.json(error, error.statusCode);
    }

    // Return the image with proper headers
    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000');
    headers.set('ETag', object.etag);

    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Avatar fetch error:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_avatar',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * DELETE /api/users/avatar
 * Delete the current user's avatar
 */
avatarRoutes.delete('/', async c => {
  const { user } = getAuth(c);

  try {
    // Delete all avatars for this user
    const listed = await c.env.PDF_BUCKET.list({ prefix: `avatars/${user.id}/` });

    for (const obj of listed.objects) {
      await c.env.PDF_BUCKET.delete(obj.key);
    }

    return c.json({ success: true, message: 'Avatar deleted' });
  } catch (error) {
    console.error('Avatar delete error:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_avatar',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { avatarRoutes };
