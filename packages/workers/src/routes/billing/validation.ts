/**
 * Stripped — GET /api/billing/validate-plan-change migrated to TanStack Start.
 * See packages/web/src/routes/api/billing/validate-plan-change.ts.
 *
 * Router file kept so packages/workers/src/routes/billing/index.ts can still mount it.
 */
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth.js';
import { validationHook } from '../../lib/honoValidationHook.js';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const billingValidationRoutes = $(base.use('*', requireAuth));
export { billingValidationRoutes };
