import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { createDomainError, isDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { getGoogleTokens, getValidAccessToken } from '@/server/googleTokens';
import { authMiddleware, type Session } from '@/server/middleware/auth';

export const handler = async ({
  context: { db, session },
}: {
  request: Request;
  context: { db: Database; session: Session };
}) => {
  const tokens = await getGoogleTokens(db, session.user.id);

  if (!tokens?.accessToken) {
    const error = createDomainError(AUTH_ERRORS.INVALID, {
      context: 'google_not_connected',
      code: 'GOOGLE_NOT_CONNECTED',
    });
    return Response.json(error, { status: 401 });
  }

  try {
    const accessToken = await getValidAccessToken(env, db, session.user.id, tokens);
    const updatedTokens = await getGoogleTokens(db, session.user.id);
    const expiresAt = updatedTokens?.accessTokenExpiresAt;

    return Response.json(
      {
        accessToken,
        expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt || null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Google Drive picker-token error:', error);
    const err = error as { message?: string; code?: string };
    if (
      (typeof err?.message === 'string' && err.message.includes('reconnect')) ||
      (typeof err?.code === 'string' && err.code.includes('GOOGLE'))
    ) {
      const authError =
        isDomainError(error) ? error : (
          createDomainError(AUTH_ERRORS.INVALID, {
            context: 'google_token_expired',
            originalError: typeof err?.message === 'string' ? err.message : String(error),
          })
        );
      return Response.json(authError, { status: 401 });
    }
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'get_google_picker_token',
      originalError: typeof err?.message === 'string' ? err.message : String(error),
    });
    return Response.json(systemError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/google-drive/picker-token')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: handler,
    },
  },
});
