import { createMiddleware } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { createDb, type Database } from '@corates/db/client';

export type { Database };

export const dbMiddleware = createMiddleware().server(async ({ next }) => {
  const db = createDb(env.DB);
  return next({ context: { db } });
});
