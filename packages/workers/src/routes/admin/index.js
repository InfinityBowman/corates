/**
 * Admin routes for Hono
 * Provides admin dashboard API endpoints
 */

import { Hono } from 'hono';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireTrustedOrigin } from '../../middleware/csrf.js';
import { userRoutes } from './users.js';
import { storageRoutes } from './storage.js';

const adminRoutes = new Hono();

// Apply admin middleware to all routes
adminRoutes.use('*', requireAdmin);
// CSRF guard for all state-changing admin routes
adminRoutes.use('*', requireTrustedOrigin);

// Mount route handlers
adminRoutes.route('/', userRoutes);
adminRoutes.route('/', storageRoutes);

export { adminRoutes };
