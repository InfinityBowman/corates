import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { projectMembers, projects } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { getProjectDocStub } from '@corates/workers/project-doc-id';
import { FILE_SIZE_LIMITS } from '@corates/workers/constants';
import {
  createDomainError,
  FILE_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { authMiddleware, type Session } from '@/server/middleware/auth';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

async function syncAvatarToProjects(db: Database, userId: string, avatarUrl: string): Promise<void> {
  try {
    const memberships = await db
      .select({ projectId: projectMembers.projectId, orgId: projects.orgId })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));

    for (const { projectId } of memberships) {
      try {
        const projectDoc = getProjectDocStub(env, projectId);
        await projectDoc.syncMember('update', { userId, image: avatarUrl });
      } catch (err) {
        console.error(`Failed to sync avatar to project ${projectId}:`, err);
      }
    }
  } catch (err) {
    console.error('Failed to sync avatar to projects:', err);
  }
}

export const handlePost = async ({
  request,
  context: { db, session },
}: {
  request: Request;
  context: { db: Database; session: Session };
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
      console.warn('Failed to delete old avatar:', e);
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
    await syncAvatarToProjects(db, userId, avatarUrl);

    return Response.json({ success: true as const, url: avatarUrl, key }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Avatar upload error:', error);
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
    return Response.json({ success: true as const, message: 'Avatar deleted' }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Avatar delete error:', error);
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
