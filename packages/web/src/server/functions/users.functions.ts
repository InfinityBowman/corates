import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import {
  deleteAccount,
  fetchMyProjects,
  fetchUserProjects,
  searchUsers as searchUsersImpl,
  syncProfile,
} from './users.server';

export const deleteMyAccount = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => deleteAccount(db, session));

export const getMyProjects = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => fetchMyProjects(db, session));

export const getUserProjects = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data, context: { db, session } }) =>
    fetchUserProjects(db, session, data.userId),
  );

export const searchUsers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      q: z.string(),
      projectId: z.string().optional(),
      limit: z.number().optional(),
    }),
  )
  .handler(async ({ data, context: { db, session, request } }) =>
    searchUsersImpl(db, session, request, data),
  );

export const syncUserProfile = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => syncProfile(db, session));
