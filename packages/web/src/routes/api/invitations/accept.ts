import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { acceptInvitation } from '@corates/workers/commands/invitations';
import {
  createDomainError,
  createValidationError,
  isDomainError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
  type DomainError,
} from '@corates/shared';

export const handler = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
    error.message = 'Invalid JSON input';
    return Response.json(error, { status: 400 });
  }

  const token = body.token;
  if (typeof token !== 'string' || token.length < 1) {
    const error = createValidationError(
      'token',
      VALIDATION_ERRORS.FIELD_REQUIRED.code,
      null,
      'required',
    );
    return Response.json(error, { status: 400 });
  }

  try {
    const result = await acceptInvitation(env, { id: session.user.id }, { token });
    return Response.json(
      {
        success: true as const,
        orgId: result.orgId,
        orgSlug: result.orgSlug ?? undefined,
        projectId: result.projectId,
        projectName: result.projectName,
        role: result.role ?? undefined,
        alreadyMember: result.alreadyMember || undefined,
      },
      { status: 200 },
    );
  } catch (err) {
    if (isDomainError(err)) {
      const de = err as DomainError;
      return Response.json(de, { status: de.statusCode });
    }
    console.error('Error accepting invitation:', err);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'accept_invitation',
      originalError: (err as Error).message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/invitations/accept')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
