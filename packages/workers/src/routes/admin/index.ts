/**
 * Admin routes with OpenAPI documentation
 * Provides admin dashboard API endpoints
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAdmin } from '@/middleware/requireAdmin';
import { requireTrustedOrigin } from '@/middleware/csrf';
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

const adminRoutes = new OpenAPIHono<{ Bindings: Env }>();

// Apply admin middleware to all routes
adminRoutes.use('*', requireAdmin);
// CSRF guard for all state-changing admin routes
adminRoutes.use('*', requireTrustedOrigin);

// Mount route handlers
adminRoutes.route('/', userRoutes);
adminRoutes.route('/', storageRoutes);
adminRoutes.route('/', billingRoutes);
adminRoutes.route('/', billingObservabilityRoutes);
adminRoutes.route('/', orgRoutes);
adminRoutes.route('/', databaseRoutes);
adminRoutes.route('/', projectRoutes);
adminRoutes.route('/', stripeToolsRoutes);
adminRoutes.route('/stats', statsRoutes);

export { adminRoutes };
