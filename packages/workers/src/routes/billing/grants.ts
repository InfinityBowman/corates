/**
 * Stripped — POST /api/billing/trial/start migrated to TanStack Start.
 * See packages/web/src/routes/api/billing/trial/start.ts.
 *
 * Router file kept so packages/workers/src/routes/billing/index.ts can still mount it.
 */
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth.js';
import { validationHook } from '../../lib/honoValidationHook.js';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const billingGrantRoutes = $(base.use('*', requireAuth));
export { billingGrantRoutes };
