/**
 * Admin routes for Hono
 * Provides admin dashboard API endpoints
 */

import { Hono } from 'hono';
import { requireAdmin } from '@/middleware/requireAdmin.js';
import { requireTrustedOrigin } from '@/middleware/csrf.js';
import { userRoutes } from './users.js';
import { storageRoutes } from './storage.js';
import { billingRoutes } from './billing.js';
import { billingObservabilityRoutes } from './billing-observability.js';
import { orgRoutes } from './orgs.js';
import { databaseRoutes } from './database.js';
import { projectRoutes } from './projects.js';

const adminRoutes = new Hono();

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

export { adminRoutes };
