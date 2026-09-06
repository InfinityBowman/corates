import { createMiddleware } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';

export const dbMiddleware = createMiddleware().server(async ({ next }) => {
  const db = createDb(env.DB);
  return next({ context: { db } });
});
