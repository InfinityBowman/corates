/**
 * Stripped — every /api/auth/* route migrated to TanStack Start (Pass 22):
 * - GET  /api/auth/session         -> packages/web/src/routes/api/auth/session.ts
 * - GET  /api/auth/verify-email    -> packages/web/src/routes/api/auth/verify-email.ts
 * - POST /api/auth/stripe/webhook  -> packages/web/src/routes/api/auth/stripe/webhook.ts
 * - ALL  /api/auth/*               -> packages/web/src/routes/api/auth/$.ts (better-auth catch-all)
 *
 * Router file kept so packages/workers/src/index.ts can still mount it; the
 * mount becomes a no-op once the catch-all `/api/$.ts` is removed in Pass 26.
 */
import { Hono } from 'hono';
import type { Env } from '../types';

const auth = new Hono<{ Bindings: Env }>();

export { auth };
