/**
 * Invitation routes for Hono
 * Handles project invitation acceptance with combined org + project flow
 */

import { OpenAPIHono, createRoute, z, $ } from '@hono/zod-openapi';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import {
  createDomainError,
  isDomainError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  type DomainError,
} from '@corates/shared';
import { acceptInvitation } from '@/commands/invitations/index.js';
import { validationHook } from '@/lib/honoValidationHook.js';
import type { Env } from '../types';
import { ErrorResponseSchema } from '@/schemas/common.js';

const base = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

const AcceptInvitationRequestSchema = z
  .object({
    token: z.string().min(1).openapi({ example: 'abc123token' }),
  })
  .openapi('AcceptInvitationRequest');

const AcceptInvitationSuccessSchema = z
  .object({
    success: z.literal(true),
    orgId: z.string().nullable().optional(),
    orgSlug: z.string().nullable().optional(),
    projectId: z.string(),
    projectName: z.string(),
    role: z.string().optional(),
    alreadyMember: z.boolean().optional(),
  })
  .openapi('AcceptInvitationSuccess');

const acceptInvitationRoute = createRoute({
  method: 'post',
  path: '/accept',
  tags: ['Invitations'],
  summary: 'Accept project invitation',
  description: 'Accept a project invitation by token. Also adds user to organization if needed.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: AcceptInvitationRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AcceptInvitationSuccessSchema } },
      description: 'Invitation accepted successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid or expired token',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Email mismatch or quota exceeded',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Internal server error',
    },
  },
});

const invitationRoutes = $(base.use('*', requireAuth)).openapi(acceptInvitationRoute, async c => {
  const { user: authUser } = getAuth(c);
  if (!authUser) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, 403);
  }

  try {
    const { token } = c.req.valid('json');
    const result = await acceptInvitation(c.env, { id: authUser.id }, { token });

    return c.json(
      {
        success: true as const,
        orgId: result.orgId,
        orgSlug: result.orgSlug ?? undefined,
        projectId: result.projectId,
        projectName: result.projectName,
        role: result.role ?? undefined,
        alreadyMember: result.alreadyMember || undefined,
      } as z.infer<typeof AcceptInvitationSuccessSchema>,
      200,
    );
  } catch (err) {
    if (isDomainError(err)) {
      return c.json(err, (err as DomainError).statusCode as 400 | 403 | 500);
    }
    console.error('Error accepting invitation:', err);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'accept_invitation',
      originalError: (err as Error).message,
    });
    return c.json(dbError, 500);
  }
});

export { invitationRoutes };
export type InvitationRoutes = typeof invitationRoutes;
