import { createServerFn } from '@tanstack/react-start';
import { getResponse } from '@tanstack/react-start/server';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import {
  listAdminUsers,
  getAdminUserDetails,
  deleteAdminUser,
  banAdminUser,
  unbanAdminUser,
  revokeAllAdminSessions,
  revokeAdminSession,
  impersonateAdminUser,
  stopImpersonation,
} from './admin-users.server';

async function forwardAuthResponse(authResponse: Response) {
  const setCookies = authResponse.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    const response = getResponse();
    for (const cookie of setCookies) {
      response.headers.append('set-cookie', cookie);
    }
  }
  if (!authResponse.ok) {
    throw authResponse;
  }
  return authResponse.json();
}

export const getAdminUsersAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      page: z.number().optional(),
      limit: z.number().optional(),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) =>
    listAdminUsers(session, db, data),
  );

export const getAdminUserDetailsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    getAdminUserDetails(session, db, data.userId),
  );

export const deleteUserAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    deleteAdminUser(session, db, data.userId),
  );

export const banUserAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      userId: z.string(),
      reason: z.string().optional(),
      expiresAt: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { userId, ...banData } = data;
    return banAdminUser(session, db, userId, banData);
  });

export const unbanUserAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    unbanAdminUser(session, db, data.userId),
  );

export const revokeAllSessionsAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    revokeAllAdminSessions(session, db, data.userId),
  );

export const revokeSessionAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ userId: z.string(), sessionId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    revokeAdminSession(session, db, data.userId, data.sessionId),
  );

export const impersonateUserAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data, context: { session, request } }) => {
    const authResponse = await impersonateAdminUser(session, request, data.userId);
    return forwardAuthResponse(authResponse);
  });

export const stopImpersonationAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { request } }) => {
    const authResponse = await stopImpersonation(request);
    return forwardAuthResponse(authResponse);
  });
