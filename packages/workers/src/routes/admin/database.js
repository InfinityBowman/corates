/**
 * Admin database viewer routes
 * Provides read-only access to D1 tables for debugging and observability
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createDb } from '@/db/client.js';
import { dbSchema, mediaFiles, organization, projects, user } from '@/db/schema.js';
import { count, desc, asc, eq, and, sum } from 'drizzle-orm';
import { createDomainError, VALIDATION_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { validateQueryParams } from '@/config/validation.js';

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
    filterBy: z
      .string()
      .optional()
      .transform(val => val?.trim()),
    filterValue: z
      .string()
      .optional()
      .transform(val => val?.trim()),
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
 * Get table schema (column names, types, and foreign key references)
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

  // Extract column info from Drizzle schema including foreign key references
  const columns = Object.entries(table).map(([name, column]) => {
    const columnInfo = {
      name,
      type: column.dataType || 'unknown',
      notNull: column.notNull ?? false,
      primaryKey: column.primary ?? false,
      unique: column.isUnique ?? false,
      hasDefault: column.hasDefault ?? false,
    };

    // Check for foreign key reference
    if (column.config?.references) {
      const refFn = column.config.references;
      try {
        const refColumn = refFn();
        if (refColumn?.table) {
          const refTableName = Object.entries(dbSchema).find(
            ([, t]) => t === refColumn.table,
          )?.[0];
          if (refTableName && ALLOWED_TABLES.includes(refTableName)) {
            columnInfo.foreignKey = {
              table: refTableName,
              column: refColumn.name,
            };
          }
        }
      } catch {
        // Reference function failed, skip FK info
      }
    }

    return columnInfo;
  });

  return c.json({ tableName, columns });
});

/**
 * GET /api/admin/database/tables/:tableName/rows
 * Get rows from a table with pagination and filtering
 * Query params:
 *   - page: page number (default 1)
 *   - limit: rows per page (default 50, max 100)
 *   - orderBy: column to sort by (default: id or first column)
 *   - order: 'asc' or 'desc' (default: desc)
 *   - filterBy: column name to filter by (optional)
 *   - filterValue: value to match (optional, required if filterBy is provided)
 */
databaseRoutes.get(
  '/database/tables/:tableName/rows',
  validateQueryParams(databaseSchemas.tableRows),
  async c => {
    const { tableName } = c.req.param();
    const {
      page,
      limit,
      orderBy: orderByParam,
      order,
      filterBy,
      filterValue,
    } = c.get('validatedQuery');

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

    // Special handling for mediaFiles with joins
    if (tableName === 'mediaFiles') {
      return handleMediaFilesQuery(c, {
        page,
        limit,
        orderBy: orderByParam,
        order,
        filterBy,
        filterValue,
      });
    }

    try {
      const db = createDb(c.env.DB);
      const offset = (page - 1) * limit;

      // Build where clause for filtering
      let whereConditions = [];
      if (filterBy && filterValue && table[filterBy]) {
        whereConditions.push(eq(table[filterBy], filterValue));
      }

      // Get total count with filtering
      let countQuery = db.select({ count: count() }).from(table);
      if (whereConditions.length > 0) {
        countQuery = countQuery.where(and(...whereConditions));
      }
      const countResult = await countQuery;
      const totalRows = countResult[0]?.count ?? 0;

      // Determine order column (use provided column, fall back to 'id', then first column)
      const columnNames = Object.keys(table);
      let orderColumnName = orderByParam;
      if (!orderColumnName || !table[orderColumnName]) {
        orderColumnName = table.id ? 'id' : columnNames[0];
      }
      const orderColumn = table[orderColumnName];
      const orderFn = order === 'asc' ? asc : desc;

      // Get rows with ordering and filtering
      let rowsQuery = db
        .select()
        .from(table)
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset);
      if (whereConditions.length > 0) {
        rowsQuery = rowsQuery.where(and(...whereConditions));
      }
      const rows = await rowsQuery;

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
      const domainError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_table_rows',
        tableName,
        originalError: error.message,
      });
      return c.json(domainError, domainError.statusCode);
    }
  },
);

/**
 * Handle mediaFiles query with joins for better readability
 */
async function handleMediaFilesQuery(
  c,
  { page, limit, orderBy: orderByParam, order, filterBy, filterValue },
) {
  try {
    const db = createDb(c.env.DB);
    const offset = (page - 1) * limit;

    // Build where conditions
    let whereConditions = [];

    // Handle filtering
    if (filterBy && filterValue) {
      if (filterBy === 'orgId' || filterBy === 'orgSlug') {
        if (filterBy === 'orgSlug') {
          // Look up org by slug first
          const org = await db
            .select({ id: organization.id })
            .from(organization)
            .where(eq(organization.slug, filterValue))
            .get();
          if (org) {
            whereConditions.push(eq(mediaFiles.orgId, org.id));
          } else {
            // Org not found, return empty results
            return c.json({
              tableName: 'mediaFiles',
              rows: [],
              pagination: {
                page,
                limit,
                totalRows: 0,
                totalPages: 0,
                orderBy: orderByParam || 'createdAt',
                order,
              },
            });
          }
        } else {
          whereConditions.push(eq(mediaFiles.orgId, filterValue));
        }
      } else if (filterBy === 'projectId') {
        whereConditions.push(eq(mediaFiles.projectId, filterValue));
      } else if (filterBy === 'uploadedBy') {
        whereConditions.push(eq(mediaFiles.uploadedBy, filterValue));
      } else if (filterBy === 'studyId') {
        whereConditions.push(eq(mediaFiles.studyId, filterValue));
      }
    }

    // Get total count with filtering
    let countQuery = db.select({ count: count() }).from(mediaFiles);
    if (whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions));
    }
    const countResult = await countQuery;
    const totalRows = countResult[0]?.count ?? 0;

    // Determine order column
    let orderColumnName = orderByParam || 'createdAt';
    let orderColumn = mediaFiles[orderColumnName];
    if (!orderColumn) {
      orderColumnName = 'createdAt';
      orderColumn = mediaFiles.createdAt;
    }
    const orderFn = order === 'asc' ? asc : desc;

    // Get rows with joins
    let rowsQuery = db
      .select({
        // mediaFiles fields
        id: mediaFiles.id,
        filename: mediaFiles.filename,
        originalName: mediaFiles.originalName,
        fileType: mediaFiles.fileType,
        fileSize: mediaFiles.fileSize,
        bucketKey: mediaFiles.bucketKey,
        createdAt: mediaFiles.createdAt,
        studyId: mediaFiles.studyId,
        // Joined fields
        orgId: mediaFiles.orgId,
        orgName: organization.name,
        orgSlug: organization.slug,
        projectId: mediaFiles.projectId,
        projectName: projects.name,
        uploadedBy: mediaFiles.uploadedBy,
        uploadedByName: user.name,
        uploadedByEmail: user.email,
        uploadedByDisplayName: user.displayName,
      })
      .from(mediaFiles)
      .leftJoin(organization, eq(mediaFiles.orgId, organization.id))
      .leftJoin(projects, eq(mediaFiles.projectId, projects.id))
      .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset);

    if (whereConditions.length > 0) {
      rowsQuery = rowsQuery.where(and(...whereConditions));
    }

    const rows = await rowsQuery;

    return c.json({
      tableName: 'mediaFiles',
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
    console.error('MediaFiles query error:', error);
    const domainError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_mediafiles_rows',
      originalError: error.message,
    });
    return c.json(domainError, domainError.statusCode);
  }
}

/**
 * GET /api/admin/database/analytics/pdfs-by-org
 * Get PDF count and total storage per organization
 */
databaseRoutes.get('/database/analytics/pdfs-by-org', async c => {
  try {
    const db = createDb(c.env.DB);

    const results = await db
      .select({
        orgId: mediaFiles.orgId,
        orgName: organization.name,
        orgSlug: organization.slug,
        pdfCount: count(mediaFiles.id),
        totalStorage: sum(mediaFiles.fileSize),
      })
      .from(mediaFiles)
      .leftJoin(organization, eq(mediaFiles.orgId, organization.id))
      .groupBy(mediaFiles.orgId, organization.name, organization.slug)
      .orderBy(desc(count(mediaFiles.id)));

    const analytics = results.map(row => ({
      orgId: row.orgId,
      orgName: row.orgName,
      orgSlug: row.orgSlug,
      pdfCount: Number(row.pdfCount || 0),
      totalStorage: Number(row.totalStorage || 0),
    }));

    return c.json({ analytics });
  } catch (error) {
    console.error('PDFs by org analytics error:', error);
    const domainError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'analytics_pdfs_by_org',
      originalError: error.message,
    });
    return c.json(domainError, domainError.statusCode);
  }
});

/**
 * GET /api/admin/database/analytics/pdfs-by-user
 * Get uploads by user
 */
databaseRoutes.get('/database/analytics/pdfs-by-user', async c => {
  try {
    const db = createDb(c.env.DB);

    const results = await db
      .select({
        userId: mediaFiles.uploadedBy,
        userName: user.name,
        userEmail: user.email,
        userDisplayName: user.displayName,
        pdfCount: count(mediaFiles.id),
        totalStorage: sum(mediaFiles.fileSize),
      })
      .from(mediaFiles)
      .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
      .groupBy(mediaFiles.uploadedBy, user.name, user.email, user.displayName)
      .orderBy(desc(count(mediaFiles.id)));

    const analytics = results
      .filter(row => row.userId) // Only include rows with a user
      .map(row => ({
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail,
        userDisplayName: row.userDisplayName,
        pdfCount: Number(row.pdfCount || 0),
        totalStorage: Number(row.totalStorage || 0),
      }));

    return c.json({ analytics });
  } catch (error) {
    console.error('PDFs by user analytics error:', error);
    const domainError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'analytics_pdfs_by_user',
      originalError: error.message,
    });
    return c.json(domainError, domainError.statusCode);
  }
});

/**
 * GET /api/admin/database/analytics/pdfs-by-project
 * Get PDFs per project
 */
databaseRoutes.get('/database/analytics/pdfs-by-project', async c => {
  try {
    const db = createDb(c.env.DB);

    const results = await db
      .select({
        projectId: mediaFiles.projectId,
        projectName: projects.name,
        orgId: mediaFiles.orgId,
        orgName: organization.name,
        orgSlug: organization.slug,
        pdfCount: count(mediaFiles.id),
        totalStorage: sum(mediaFiles.fileSize),
      })
      .from(mediaFiles)
      .leftJoin(projects, eq(mediaFiles.projectId, projects.id))
      .leftJoin(organization, eq(mediaFiles.orgId, organization.id))
      .groupBy(
        mediaFiles.projectId,
        projects.name,
        mediaFiles.orgId,
        organization.name,
        organization.slug,
      )
      .orderBy(desc(count(mediaFiles.id)));

    const analytics = results.map(row => ({
      projectId: row.projectId,
      projectName: row.projectName,
      orgId: row.orgId,
      orgName: row.orgName,
      orgSlug: row.orgSlug,
      pdfCount: Number(row.pdfCount || 0),
      totalStorage: Number(row.totalStorage || 0),
    }));

    return c.json({ analytics });
  } catch (error) {
    console.error('PDFs by project analytics error:', error);
    const domainError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'analytics_pdfs_by_project',
      originalError: error.message,
    });
    return c.json(domainError, domainError.statusCode);
  }
});

/**
 * GET /api/admin/database/analytics/recent-uploads
 * Get recent PDF uploads with user/org context
 * Query params:
 *   - limit: number of recent uploads (default 50, max 100)
 */
databaseRoutes.get(
  '/database/analytics/recent-uploads',
  validateQueryParams(
    z.object({
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
    }),
  ),
  async c => {
    try {
      const { limit } = c.get('validatedQuery');
      const db = createDb(c.env.DB);

      const results = await db
        .select({
          id: mediaFiles.id,
          filename: mediaFiles.filename,
          originalName: mediaFiles.originalName,
          fileSize: mediaFiles.fileSize,
          createdAt: mediaFiles.createdAt,
          orgId: mediaFiles.orgId,
          orgName: organization.name,
          orgSlug: organization.slug,
          projectId: mediaFiles.projectId,
          projectName: projects.name,
          uploadedBy: mediaFiles.uploadedBy,
          uploadedByName: user.name,
          uploadedByEmail: user.email,
          uploadedByDisplayName: user.displayName,
        })
        .from(mediaFiles)
        .leftJoin(organization, eq(mediaFiles.orgId, organization.id))
        .leftJoin(projects, eq(mediaFiles.projectId, projects.id))
        .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
        .orderBy(desc(mediaFiles.createdAt))
        .limit(limit);

      const uploads = results.map(row => ({
        id: row.id,
        filename: row.filename,
        originalName: row.originalName,
        fileSize: row.fileSize,
        createdAt: row.createdAt,
        org: {
          id: row.orgId,
          name: row.orgName,
          slug: row.orgSlug,
        },
        project: {
          id: row.projectId,
          name: row.projectName,
        },
        uploadedBy:
          row.uploadedBy ?
            {
              id: row.uploadedBy,
              name: row.uploadedByName,
              email: row.uploadedByEmail,
              displayName: row.uploadedByDisplayName,
            }
          : null,
      }));

      return c.json({ uploads });
    } catch (error) {
      console.error('Recent uploads analytics error:', error);
      const domainError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'analytics_recent_uploads',
        originalError: error.message,
      });
      return c.json(domainError, domainError.statusCode);
    }
  },
);

export { databaseRoutes };
