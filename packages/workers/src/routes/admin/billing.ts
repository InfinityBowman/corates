/**
 * Stripped — admin billing routes (org subscriptions + grants CRUD plus the
 * trial / single-project convenience endpoints) migrated to TanStack Start.
 * See packages/web/src/routes/api/admin/orgs/$orgId/{billing,subscriptions,grants,grant-trial,grant-single-project}.
 *
 * Router file kept so packages/workers/src/routes/admin/index.ts can still mount it.
 */
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validationHook } from '../../lib/honoValidationHook';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const billingRoutes = $(base.use('*', requireAdmin));
export { billingRoutes };
