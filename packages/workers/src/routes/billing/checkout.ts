/**
 * Stripped — POST /api/billing/{validate-coupon,checkout,single-project/checkout}
 * migrated to TanStack Start. See packages/web/src/routes/api/billing/.
 *
 * Router file kept so packages/workers/src/routes/billing/index.ts can still mount it.
 */
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import { validationHook } from '../../lib/honoValidationHook';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const billingCheckoutRoutes = $(base.use('*', requireAuth));
export { billingCheckoutRoutes };
