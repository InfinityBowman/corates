/**
 * Dev-only routes -- migrated to TanStack Start at
 * packages/web/src/routes/api/orgs/$orgId/projects/$projectId/dev/*.
 * This file stubs out an empty router so the top-level mount still compiles.
 */

import { OpenAPIHono, $ } from '@hono/zod-openapi';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>();

const devRoutes = $(base);

export { devRoutes };
