/**
 * Admin database viewer routes
 * Provides read-only access to D1 tables for debugging and observability
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import { dbSchema } from '../../db/schema.js';
import { count, desc, asc } from 'drizzle-orm';

const databaseRoutes = new Hono();

// Whitelist of viewable tables (security: no raw SQL)
const ALLOWED_TABLES = [
  'user',
  'session',
  'account',
  'verification',
  'twoFactor',
  'organization',
  'member',
  'invitation',
  'projects',
  'projectMembers',
  'mediaFiles',
  'subscription',
  'orgAccessGrants',
  'stripeEventLedger',
  'projectInvitations',
];

/**
 * GET /api/admin/database/tables
 * List all available tables with row counts
 */
databaseRoutes.get('/database/tables', async c => {
  const db = createDb(c.env.DB);

  const tables = await Promise.all(
    ALLOWED_TABLES.map(async tableName => {
      const table = dbSchema[tableName];
      if (!table) return null;

      try {
        const result = await db.select({ count: count() }).from(table);
        return {
          name: tableName,
          rowCount: result[0]?.count ?? 0,
        };
      } catch {
        return {
          name: tableName,
          rowCount: 0,
          error: 'Failed to count rows',
        };
      }
    }),
  );

  return c.json({
    tables: tables.filter(Boolean),
  });
});

/**
 * GET /api/admin/database/tables/:tableName/schema
 * Get table schema (column names and types)
 */
databaseRoutes.get('/database/tables/:tableName/schema', async c => {
  const { tableName } = c.req.param();

  if (!ALLOWED_TABLES.includes(tableName)) {
    return c.json({ error: 'Table not found' }, 404);
  }

  const table = dbSchema[tableName];
  if (!table) {
    return c.json({ error: 'Table not found' }, 404);
  }

  // Extract column info from Drizzle schema
  const columns = Object.entries(table).map(([name, column]) => ({
    name,
    type: column.dataType || 'unknown',
    notNull: column.notNull ?? false,
    primaryKey: column.primary ?? false,
  }));

  return c.json({ tableName, columns });
});

/**
 * GET /api/admin/database/tables/:tableName/rows
 * Get rows from a table with pagination
 * Query params:
 *   - page: page number (default 1)
 *   - limit: rows per page (default 50, max 100)
 *   - orderBy: column to sort by (default: id or first column)
 *   - order: 'asc' or 'desc' (default: desc)
 */
databaseRoutes.get('/database/tables/:tableName/rows', async c => {
  const { tableName } = c.req.param();
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));
  const orderByParam = c.req.query('orderBy') || '';
  const order = c.req.query('order') === 'asc' ? 'asc' : 'desc';

  if (!ALLOWED_TABLES.includes(tableName)) {
    return c.json({ error: 'Table not found' }, 404);
  }

  const table = dbSchema[tableName];
  if (!table) {
    return c.json({ error: 'Table not found' }, 404);
  }

  const db = createDb(c.env.DB);
  const offset = (page - 1) * limit;

  // Get total count
  const countResult = await db.select({ count: count() }).from(table);
  const totalRows = countResult[0]?.count ?? 0;

  // Determine order column (use provided column, fall back to 'id', then first column)
  const columnNames = Object.keys(table);
  let orderColumnName = orderByParam;
  if (!orderColumnName || !table[orderColumnName]) {
    orderColumnName = table.id ? 'id' : columnNames[0];
  }
  const orderColumn = table[orderColumnName];
  const orderFn = order === 'asc' ? asc : desc;

  // Get rows with ordering
  const rows = await db
    .select()
    .from(table)
    .orderBy(orderFn(orderColumn))
    .limit(limit)
    .offset(offset);

  return c.json({
    tableName,
    rows,
    pagination: {
      page,
      limit,
      totalRows,
      totalPages: Math.ceil(totalRows / limit),
      orderBy: orderColumnName,
      order,
    },
  });
});

export { databaseRoutes };
