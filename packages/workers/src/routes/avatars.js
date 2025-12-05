/**
 * Avatar routes for Hono
 * Handle profile picture upload/download via R2 storage
 *
 * Avatars are stored with keys: avatars/{userId}/{filename}
 */

import { Hono } from 'hono';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { createErrorResponse, ERROR_CODES } from '../config/constants.js';

const avatarRoutes = new Hono();

// Apply auth middleware to all routes
avatarRoutes.use('*', requireAuth);

// Maximum avatar file size (2MB - smaller than general IMAGE limit)
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * POST /api/users/avatar
 * Upload a new avatar image
 */
avatarRoutes.post('/', async c => {
  const { user } = getAuth(c);

  // Check Content-Length header first for early rejection
  const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);
  if (contentLength > MAX_AVATAR_SIZE) {
    return c.json(
      createErrorResponse(
        ERROR_CODES.FILE_TOO_LARGE,
        `Avatar size exceeds limit of ${MAX_AVATAR_SIZE / (1024 * 1024)}MB`,
      ),
      413,
    );
  }

  try {
    const contentType = c.req.header('Content-Type') || '';

    // Handle multipart form data
    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('avatar');

      if (!file || !(file instanceof File)) {
        return c.json(createErrorResponse(ERROR_CODES.VALIDATION, 'No avatar file provided'), 400);
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return c.json(
          createErrorResponse(
            ERROR_CODES.VALIDATION,
            'Invalid file type. Allowed: JPEG, PNG, GIF, WebP',
          ),
          400,
        );
      }

      // Validate file size (double-check after parsing)
      if (file.size > MAX_AVATAR_SIZE) {
        return c.json(
          createErrorResponse(
            ERROR_CODES.FILE_TOO_LARGE,
            `Avatar size exceeds limit of ${MAX_AVATAR_SIZE / (1024 * 1024)}MB`,
          ),
          413,
        );
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
      const avatarUrl = `${c.req.url.split('/api/')[0]}/api/users/avatar/${user.id}`;

      return c.json({
        success: true,
        url: avatarUrl,
        key,
      });
    }

    return c.json(createErrorResponse(ERROR_CODES.VALIDATION, 'Invalid content type'), 400);
  } catch (error) {
    console.error('Avatar upload error:', error);
    return c.json(createErrorResponse(ERROR_CODES.DB_ERROR, error.message), 500);
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
      return c.json({ error: 'Avatar not found' }, 404);
    }

    // Get the most recent avatar
    const avatarKey = listed.objects[0].key;
    const object = await c.env.PDF_BUCKET.get(avatarKey);

    if (!object) {
      return c.json({ error: 'Avatar not found' }, 404);
    }

    // Return the image with proper headers
    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000');
    headers.set('ETag', object.etag);

    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Avatar fetch error:', error);
    return c.json(createErrorResponse(ERROR_CODES.DB_ERROR, error.message), 500);
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
    return c.json(createErrorResponse(ERROR_CODES.DB_ERROR, error.message), 500);
  }
});

export { avatarRoutes };
