/**
 * Stripped — GET /api/billing/invoices migrated to TanStack Start.
 * See packages/web/src/routes/api/billing/invoices.ts.
 *
 * Router file kept so packages/workers/src/routes/billing/index.ts can still mount it.
 */
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth.js';
import { validationHook } from '../../lib/honoValidationHook.js';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const billingInvoicesRoutes = $(base.use('*', requireAuth));
export { billingInvoicesRoutes };
