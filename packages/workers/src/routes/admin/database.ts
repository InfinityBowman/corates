/**
 * Stripped — admin database viewer (tables list/schema/rows + 4 analytics
 * endpoints) migrated to TanStack Start. See packages/web/src/routes/api/admin/database/.
 *
 * Router file kept so packages/workers/src/routes/admin/index.ts can still mount it.
 */
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validationHook } from '../../lib/honoValidationHook';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const databaseRoutes = $(base.use('*', requireAdmin));
export { databaseRoutes };
