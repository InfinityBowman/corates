import { createServerFn } from '@tanstack/react-start';
import { authMiddleware } from '@/server/middleware/auth';
import { fetchUsage, fetchSubscription } from './billing.server';

export const getUsage = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => fetchUsage(db, session));

export const getSubscription = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { db, session } }) => fetchSubscription(db, session));
