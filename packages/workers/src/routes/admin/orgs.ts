/**
 * Stripped — GET /api/admin/orgs and GET /api/admin/orgs/:orgId migrated to
 * TanStack Start. See packages/web/src/routes/api/admin/orgs.ts and
 * packages/web/src/routes/api/admin/orgs/$orgId.ts.
 *
 * Router file kept so packages/workers/src/routes/admin/index.ts can still mount it.
 */
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validationHook } from '../../lib/honoValidationHook';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const orgRoutes = $(base.use('*', requireAdmin));
export { orgRoutes };
