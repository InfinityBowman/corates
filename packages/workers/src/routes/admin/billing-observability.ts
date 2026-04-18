/**
 * Stripped — GET /api/admin/billing/{ledger,stuck-states} and
 * GET /api/admin/orgs/:orgId/billing/reconcile migrated to TanStack Start.
 * See packages/web/src/routes/api/admin/billing/ and
 * packages/web/src/routes/api/admin/orgs/$orgId/billing/.
 *
 * Router file kept so packages/workers/src/routes/admin/index.ts can still mount it.
 */
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validationHook } from '../../lib/honoValidationHook';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const billingObservabilityRoutes = $(base.use('*', requireAdmin));
export { billingObservabilityRoutes };
