/**
 * Admin routes with OpenAPI documentation
 * Provides admin dashboard API endpoints
 */

import { $, OpenAPIHono } from '@hono/zod-openapi';
import { requireAdmin } from '../../middleware/requireAdmin';
import { requireTrustedOrigin } from '../../middleware/csrf';
import { userRoutes } from './users.js';
import { storageRoutes } from './storage.js';
import { billingRoutes } from './billing.js';
import { billingObservabilityRoutes } from './billing-observability.js';
import { orgRoutes } from './orgs.js';
import { databaseRoutes } from './database.js';
import { projectRoutes } from './projects.js';
import { stripeToolsRoutes } from './stripe-tools.js';
import { statsRoutes } from './stats.js';
import type { Env } from '../../types';

const _adminBase = new OpenAPIHono<{ Bindings: Env }>();

// Apply admin middleware to all routes, then mount route handlers
const adminRoutes = $(_adminBase.use('*', requireAdmin).use('*', requireTrustedOrigin))
  .route('/', userRoutes)
  .route('/', storageRoutes)
  .route('/', billingRoutes)
  .route('/', billingObservabilityRoutes)
  .route('/', orgRoutes)
  .route('/', databaseRoutes)
  .route('/', projectRoutes)
  .route('/', stripeToolsRoutes)
  .route('/stats', statsRoutes);

export { adminRoutes };
