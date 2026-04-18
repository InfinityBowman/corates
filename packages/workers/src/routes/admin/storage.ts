/**
 * Stripped — GET/DELETE /api/admin/storage/documents and GET /api/admin/storage/stats
 * migrated to TanStack Start. See packages/web/src/routes/api/admin/storage/.
 *
 * Router file kept so packages/workers/src/routes/admin/index.ts can still mount it.
 */
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validationHook } from '../../lib/honoValidationHook';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const storageRoutes = $(base.use('*', requireAdmin));
export { storageRoutes };
