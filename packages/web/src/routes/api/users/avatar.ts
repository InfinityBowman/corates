import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { FILE_SIZE_LIMITS } from '@corates/workers/constants';
import { createDomainError, FILE_ERRORS, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { authMiddleware, type Session } from '@/server/middleware/auth';
import { captureError, info, warn } from '@corates/workers/logger';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const handlePost = async ({
  request,
  context: { session },
}: {
  request: Request;
  context: { session: Session };
}) => {
  const userId = session.user.id;

  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLength > FILE_SIZE_LIMITS.AVATAR) {
    const error = createDomainError(
      FILE_ERRORS.TOO_LARGE,
      { fileSize: contentLength, maxSize: FILE_SIZE_LIMITS.AVATAR },
      `Avatar size exceeds limit of ${FILE_SIZE_LIMITS.AVATAR / (1024 * 1024)}MB`,
    );
    return Response.json(error, { status: 413 });
  }

  try {
    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.includes('multipart/form-data')) {
      const error = createDomainError(
        VALIDATION_ERRORS.FIELD_INVALID_FORMAT,
        { field: 'Content-Type' },
        'Invalid content type',
      );
      return Response.json(error, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!file || !(file instanceof File)) {
      const error = createDomainError(
        VALIDATION_ERRORS.FIELD_REQUIRED,
        { field: 'avatar' },
        'No avatar file provided',
      );
      return Response.json(error, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      const error = createDomainError(
        FILE_ERRORS.INVALID_TYPE,
        { fileType: file.type, allowedTypes: ALLOWED_TYPES },
        'Invalid file type. Allowed: JPEG, PNG, GIF, WebP',
      );
      return Response.json(error, { status: 400 });
    }

    if (file.size > FILE_SIZE_LIMITS.AVATAR) {
      const error = createDomainError(
        FILE_ERRORS.TOO_LARGE,
        { fileSize: file.size, maxSize: FILE_SIZE_LIMITS.AVATAR },
        `Avatar size exceeds limit of ${FILE_SIZE_LIMITS.AVATAR / (1024 * 1024)}MB`,
      );
      return Response.json(error, { status: 413 });
    }

    const ext = file.type.split('/')[1] || 'jpg';
    const timestamp = Date.now();
    const key = `avatars/${userId}/${timestamp}.${ext}`;

    try {
      const oldAvatars = await env.PDF_BUCKET.list({ prefix: `avatars/${userId}/` });
      for (const obj of oldAvatars.objects) {
        await env.PDF_BUCKET.delete(obj.key);
      }
    } catch (e) {
      warn('Failed to delete old avatar', { error: String(e) });
    }

    const arrayBuffer = await file.arrayBuffer();
    await env.PDF_BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000',
      },
      customMetadata: {
        userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const avatarUrl = `/api/users/avatar/${userId}?t=${timestamp}`;

    info('avatar.uploaded', { userId, size: file.size });

    return Response.json({ success: true as const, url: avatarUrl, key }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    captureError(error, { tags: { component: 'avatars', action: 'upload' } });
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'upload_avatar',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const handleDelete = async ({
  context: { session },
}: {
  request: Request;
  context: { session: Session };
}) => {
  const userId = session.user.id;

  try {
    const listed = await env.PDF_BUCKET.list({ prefix: `avatars/${userId}/` });
    for (const obj of listed.objects) {
      await env.PDF_BUCKET.delete(obj.key);
    }
    info('avatar.deleted', { userId });
    return Response.json({ success: true as const, message: 'Avatar deleted' }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    captureError(error, { tags: { component: 'avatars', action: 'delete' } });
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_avatar',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/users/avatar')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: handlePost,
      DELETE: handleDelete,
    },
  },
});
