import { createServerFn } from '@tanstack/react-start';
import { authMiddleware } from '@/server/middleware/auth';
import { listUsers, usersPostDeprecated } from './db-users.server';

export const getDbUsers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db } }) => listUsers(db));

export const postDbUsers = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async () => usersPostDeprecated());
