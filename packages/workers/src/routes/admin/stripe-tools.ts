/**
 * Stripped — admin Stripe tools (customer lookup, portal-link, invoices,
 * payment-methods, subscriptions) migrated to TanStack Start. See
 * packages/web/src/routes/api/admin/stripe/.
 *
 * Router file kept so packages/workers/src/routes/admin/index.ts can still mount it.
 */
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validationHook } from '../../lib/honoValidationHook';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const stripeToolsRoutes = $(base.use('*', requireAdmin));
export { stripeToolsRoutes };
