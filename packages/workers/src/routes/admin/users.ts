/**
 * Stripped — admin user management routes (stats, list, details, ban/unban,
 * impersonate, session revocation, delete) migrated to TanStack Start. See
 * packages/web/src/routes/api/admin/{stats,users,users/$userId,users/$userId/...}.
 *
 * Router file kept so packages/workers/src/routes/admin/index.ts can still mount it.
 */
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validationHook } from '../../lib/honoValidationHook';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const userRoutes = $(base.use('*', requireAdmin));
export { userRoutes };
