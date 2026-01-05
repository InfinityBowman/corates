/**
 * Admin database viewer routes
 * Provides read-only access to D1 tables for debugging and observability
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '../../db/client.js';
import { dbSchema } from '../../db/schema.js';
import { count, desc, asc } from 'drizzle-orm';
import { createDomainError, VALIDATION_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { validateQueryParams } from '../../config/validation.js';

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
 * Database viewer schemas
 */
const databaseSchemas = {
  tableRows: z.object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform(val => parseInt(val, 10))
      .pipe(z.number().int('Page must be an integer').min(1, 'Page must be at least 1')),
    limit: z
      .string()
      .optional()
      .default('50')
      .transform(val => parseInt(val, 10))
      .pipe(
        z
          .number()
          .int('Limit must be an integer')
          .min(1, 'Limit must be at least 1')
          .max(100, 'Limit must be at most 100'),
      ),
    orderBy: z
      .string()
      .optional()
      .default('')
      .transform(val => val.trim()),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
};

/**
 * GET /api/admin/database/tables
 * List all available tables with row counts
 */
databaseRoutes.get('/database/tables', async c => {
  try {
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
  } catch (error) {
    console.error('Database tables list error:', error);
    const domainError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      message: 'Failed to list database tables',
    });
    return c.json(domainError, domainError.statusCode);
  }
});

/**
 * GET /api/admin/database/tables/:tableName/schema
 * Get table schema (column names and types)
 */
databaseRoutes.get('/database/tables/:tableName/schema', async c => {
  const { tableName } = c.req.param();

  if (!ALLOWED_TABLES.includes(tableName)) {
    const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
      field: 'tableName',
      value: tableName,
      message: `Table '${tableName}' is not available for viewing`,
    });
    return c.json(error, error.statusCode);
  }

  const table = dbSchema[tableName];
  if (!table) {
    const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
      field: 'tableName',
      value: tableName,
      message: `Table '${tableName}' not found in schema`,
    });
    return c.json(error, error.statusCode);
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
databaseRoutes.get(
  '/database/tables/:tableName/rows',
  validateQueryParams(databaseSchemas.tableRows),
  async c => {
    const { tableName } = c.req.param();
    const { page, limit, orderBy: orderByParam, order } = c.get('validatedQuery');

    if (!ALLOWED_TABLES.includes(tableName)) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'tableName',
        value: tableName,
        message: `Table '${tableName}' is not available for viewing`,
      });
      return c.json(error, error.statusCode);
    }

    const table = dbSchema[tableName];
    if (!table) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'tableName',
        value: tableName,
        message: `Table '${tableName}' not found in schema`,
      });
      return c.json(error, error.statusCode);
    }

    try {
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
    } catch (error) {
      console.error('Database rows fetch error:', error);
      const domainError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        message: `Failed to fetch rows from table '${tableName}'`,
      });
      return c.json(domainError, domainError.statusCode);
    }
  },
);

export { databaseRoutes };
