/**
 * Example API Route Template
 *
 * Demonstrates all key patterns for CoRATES API routes.
 * Copy and modify for new route files.
 */

import { Hono } from 'hono';
import { eq, and, desc, count } from 'drizzle-orm';
import { z } from 'zod';

// Database
import { createDb } from '@/db/client.js';
import { items, itemMembers } from '@/db/schema.js';

// Middleware
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { requireOrgMembership, getOrgContext } from '@/middleware/requireOrg.js';
import { requireOrgWriteAccess } from '@/middleware/requireOrgWriteAccess.js';
import { requireEntitlement } from '@/middleware/requireEntitlement.js';
import { requireQuota } from '@/middleware/requireQuota.js';
import { validateRequest } from '@/config/validation.js';

// Errors
import {
  createDomainError,
  createValidationError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';

// ---------------------
// Zod Schemas
// ---------------------
// Add these to packages/workers/src/config/validation.js

export const itemSchemas = {
  create: z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(255, 'Name must be 255 characters or less')
      .transform(val => val.trim()),
    description: z
      .string()
      .max(2000, 'Description must be 2000 characters or less')
      .optional()
      .transform(val => val?.trim() || null),
    type: z.enum(['typeA', 'typeB', 'typeC']).optional().default('typeA'),
    active: z.boolean().optional().default(true),
  }),

  update: z.object({
    name: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .transform(val => val?.trim()),
    description: z
      .string()
      .max(2000)
      .optional()
      .transform(val => val?.trim() || null),
    type: z.enum(['typeA', 'typeB', 'typeC']).optional(),
    active: z.boolean().optional(),
  }),
};

// Define custom error codes in @corates/shared if needed
const ITEM_ERRORS = {
  NOT_FOUND: { code: 'ITEM_NOT_FOUND', statusCode: 404, message: 'Item not found' },
  ALREADY_EXISTS: { code: 'ITEM_ALREADY_EXISTS', statusCode: 409, message: 'Item already exists' },
};

// ---------------------
// Route Setup
// ---------------------

const itemRoutes = new Hono();

// Apply authentication to all routes
itemRoutes.use('*', requireAuth);

// ---------------------
// Helper Functions
// ---------------------

/**
 * Get item count for quota check
 */
async function getItemCount(c, user) {
  const { orgId } = getOrgContext(c);
  const db = createDb(c.env.DB);
  const [result] = await db.select({ count: count() }).from(items).where(eq(items.orgId, orgId));
  return result?.count || 0;
}

// ---------------------
// Routes
// ---------------------

/**
 * GET / - List items
 *
 * Query params:
 * - limit: number (default 50, max 100)
 * - offset: number (default 0)
 * - type: string (filter by type)
 */
itemRoutes.get('/', requireOrgMembership(), async c => {
  const { user } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const db = createDb(c.env.DB);

  // Parse query params
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const typeFilter = c.req.query('type');

  try {
    let query = db
      .select({
        id: items.id,
        name: items.name,
        description: items.description,
        type: items.type,
        active: items.active,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
      })
      .from(items)
      .where(eq(items.orgId, orgId))
      .orderBy(desc(items.updatedAt))
      .limit(limit)
      .offset(offset);

    // Apply type filter if provided
    if (typeFilter) {
      query = query.where(and(eq(items.orgId, orgId), eq(items.type, typeFilter)));
    }

    const results = await query;

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: count() })
      .from(items)
      .where(eq(items.orgId, orgId));

    return c.json({
      items: results,
      pagination: {
        total: countResult?.count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_items',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /:id - Get single item
 */
itemRoutes.get('/:id', requireOrgMembership(), async c => {
  const { user } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const itemId = c.req.param('id');
  const db = createDb(c.env.DB);

  try {
    const result = await db
      .select()
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.orgId, orgId)))
      .get();

    if (!result) {
      const error = createDomainError(ITEM_ERRORS.NOT_FOUND, { itemId });
      return c.json(error, error.statusCode);
    }

    return c.json(result);
  } catch (error) {
    console.error('Error fetching item:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_item',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST / - Create item
 *
 * Full middleware chain:
 * 1. requireOrgMembership - Check user is org member
 * 2. requireOrgWriteAccess - Check user has write permission
 * 3. requireEntitlement - Check org has feature access
 * 4. requireQuota - Check org hasn't exceeded quota
 * 5. validateRequest - Validate request body
 */
itemRoutes.post(
  '/',
  requireOrgMembership(),
  requireOrgWriteAccess(),
  requireEntitlement('items.create'),
  requireQuota('items.max', getItemCount, 1),
  validateRequest(itemSchemas.create),
  async c => {
    const { user } = getAuth(c);
    const { orgId } = getOrgContext(c);
    const { name, description, type, active } = c.get('validatedBody');
    const db = createDb(c.env.DB);

    const itemId = crypto.randomUUID();
    const now = new Date();

    try {
      await db.insert(items).values({
        id: itemId,
        orgId,
        name,
        description,
        type,
        active,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      });

      const newItem = {
        id: itemId,
        orgId,
        name,
        description,
        type,
        active,
        createdAt: now,
        updatedAt: now,
      };

      return c.json(newItem, 201);
    } catch (error) {
      console.error('Error creating item:', error);

      // Handle unique constraint violation
      if (error?.message?.includes('UNIQUE constraint failed')) {
        const conflictError = createDomainError(ITEM_ERRORS.ALREADY_EXISTS, {
          name,
        });
        return c.json(conflictError, conflictError.statusCode);
      }

      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'create_item',
        originalError: error.message,
      });
      return c.json(dbError, dbError.statusCode);
    }
  },
);

/**
 * PATCH /:id - Update item
 */
itemRoutes.patch(
  '/:id',
  requireOrgMembership(),
  requireOrgWriteAccess(),
  validateRequest(itemSchemas.update),
  async c => {
    const { user } = getAuth(c);
    const { orgId } = getOrgContext(c);
    const itemId = c.req.param('id');
    const updates = c.get('validatedBody');
    const db = createDb(c.env.DB);

    try {
      // Verify item exists and belongs to org
      const existing = await db
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.id, itemId), eq(items.orgId, orgId)))
        .get();

      if (!existing) {
        const error = createDomainError(ITEM_ERRORS.NOT_FOUND, { itemId });
        return c.json(error, error.statusCode);
      }

      // Build update object with only provided fields
      const updateData = { updatedAt: new Date() };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.active !== undefined) updateData.active = updates.active;

      await db.update(items).set(updateData).where(eq(items.id, itemId));

      return c.json({ success: true, itemId });
    } catch (error) {
      console.error('Error updating item:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_item',
        originalError: error.message,
      });
      return c.json(dbError, dbError.statusCode);
    }
  },
);

/**
 * DELETE /:id - Delete item
 *
 * Requires owner/admin role via requireOrgMembership('admin')
 */
itemRoutes.delete('/:id', requireOrgMembership('admin'), async c => {
  const { user } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const itemId = c.req.param('id');
  const db = createDb(c.env.DB);

  try {
    // Verify item exists
    const existing = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.orgId, orgId)))
      .get();

    if (!existing) {
      const error = createDomainError(ITEM_ERRORS.NOT_FOUND, { itemId });
      return c.json(error, error.statusCode);
    }

    // Delete with cascade (if needed)
    await db.batch([
      // Delete related records first
      db.delete(itemMembers).where(eq(itemMembers.itemId, itemId)),
      // Then delete main record
      db.delete(items).where(eq(items.id, itemId)),
    ]);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_item',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

// ---------------------
// Nested Routes Example
// ---------------------

// Import and mount nested routes
// import { itemMemberRoutes } from './item-members.js';
// itemRoutes.route('/:itemId/members', itemMemberRoutes);

// ---------------------
// Export
// ---------------------

export { itemRoutes };

// ---------------------
// Registration (in index.js)
// ---------------------

// import { itemRoutes } from './routes/items.js';
// app.route('/api/orgs/:orgId/items', itemRoutes);
