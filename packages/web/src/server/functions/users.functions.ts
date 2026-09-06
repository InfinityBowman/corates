import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import { deleteAccount, fetchMyProjects, searchUsers as searchUsersImpl } from './users.server';

export const deleteMyAccount = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => deleteAccount(db, session));

export const getMyProjects = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => fetchMyProjects(db, session));

export const searchUsers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      q: z.string(),
      projectId: z.string().optional(),
      limit: z.number().optional(),
    }),
  )
  .handler(async ({ data, context: { db, session, request } }) =>
    searchUsersImpl(db, session, request, data),
  );
