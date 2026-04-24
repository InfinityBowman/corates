import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDomainError, FILE_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { authMiddleware } from '@/server/middleware/auth';

export const handler = async ({ params }: { request: Request; params: { userId: string } }) => {
  const { userId } = params;

  try {
    const listed = await env.PDF_BUCKET.list({ prefix: `avatars/${userId}/` });
    if (listed.objects.length === 0) {
      const error = createDomainError(FILE_ERRORS.NOT_FOUND, { fileName: 'avatar' });
      return Response.json(error, { status: 404 });
    }

    const avatarKey = listed.objects[0].key;
    const object = await env.PDF_BUCKET.get(avatarKey);

    if (!object) {
      const error = createDomainError(FILE_ERRORS.NOT_FOUND, { fileName: 'avatar' });
      return Response.json(error, { status: 404 });
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
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/users/avatar/$userId')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: handler,
    },
  },
});
