/**
 * Admin database viewer routes
 * Provides read-only access to D1 tables for debugging and observability
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@/db/client.js';
import { dbSchema, mediaFiles, organization, projects, user } from '@/db/schema.js';
import { count, desc, asc, eq, and, sum } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { validationHook } from '@/lib/honoValidationHook.js';

const databaseRoutes = new OpenAPIHono({
  defaultHook: validationHook,
});

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

// Response schemas
const TableInfoSchema = z
  .object({
    name: z.string(),
    rowCount: z.number(),
    error: z.string().optional(),
  })
  .openapi('TableInfo');

const TablesListResponseSchema = z
  .object({
    tables: z.array(TableInfoSchema),
  })
  .openapi('TablesListResponse');

const ColumnInfoSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    notNull: z.boolean(),
    primaryKey: z.boolean(),
    unique: z.boolean(),
    hasDefault: z.boolean(),
    foreignKey: z
      .object({
        table: z.string(),
        column: z.string(),
      })
      .optional(),
  })
  .openapi('ColumnInfo');

const TableSchemaResponseSchema = z
  .object({
    tableName: z.string(),
    columns: z.array(ColumnInfoSchema),
  })
  .openapi('TableSchemaResponse');

const PaginationInfoSchema = z
  .object({
    page: z.number(),
    limit: z.number(),
    totalRows: z.number(),
    totalPages: z.number(),
    orderBy: z.string(),
    order: z.enum(['asc', 'desc']),
  })
  .openapi('DatabasePaginationInfo');

const TableRowsResponseSchema = z
  .object({
    tableName: z.string(),
    rows: z.array(z.record(z.unknown())),
    pagination: PaginationInfoSchema,
  })
  .openapi('TableRowsResponse');

const OrgAnalyticsSchema = z
  .object({
    orgId: z.string(),
    orgName: z.string().nullable(),
    orgSlug: z.string().nullable(),
    pdfCount: z.number(),
    totalStorage: z.number(),
  })
  .openapi('OrgAnalytics');

const UserAnalyticsSchema = z
  .object({
    userId: z.string(),
    userName: z.string().nullable(),
    userEmail: z.string().nullable(),
    userDisplayName: z.string().nullable(),
    pdfCount: z.number(),
    totalStorage: z.number(),
  })
  .openapi('UserAnalytics');

const ProjectAnalyticsSchema = z
  .object({
    projectId: z.string(),
    projectName: z.string().nullable(),
    orgId: z.string(),
    orgName: z.string().nullable(),
    orgSlug: z.string().nullable(),
    pdfCount: z.number(),
    totalStorage: z.number(),
  })
  .openapi('ProjectAnalytics');

const RecentUploadSchema = z
  .object({
    id: z.string(),
    filename: z.string(),
    originalName: z.string().nullable(),
    fileSize: z.number().nullable(),
    createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    org: z.object({
      id: z.string(),
      name: z.string().nullable(),
      slug: z.string().nullable(),
    }),
    project: z.object({
      id: z.string(),
      name: z.string().nullable(),
    }),
    uploadedBy: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
        displayName: z.string().nullable(),
      })
      .nullable(),
  })
  .openapi('RecentUpload');

const DatabaseErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('DatabaseError');

// Route definitions
const listTablesRoute = createRoute({
  method: 'get',
  path: '/database/tables',
  tags: ['Admin - Database'],
  summary: 'List all tables',
  description: 'List all available tables with row counts. Admin only.',
  responses: {
    200: {
      description: 'List of tables',
      content: {
        'application/json': {
          schema: TablesListResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: DatabaseErrorSchema,
        },
      },
    },
  },
});

const getTableSchemaRoute = createRoute({
  method: 'get',
  path: '/database/tables/{tableName}/schema',
  tags: ['Admin - Database'],
  summary: 'Get table schema',
  description:
    'Get table schema including column names, types, and foreign key references. Admin only.',
  request: {
    params: z.object({
      tableName: z.string().openapi({ description: 'Table name', example: 'user' }),
    }),
  },
  responses: {
    200: {
      description: 'Table schema',
      content: {
        'application/json': {
          schema: TableSchemaResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid table name',
      content: {
        'application/json': {
          schema: DatabaseErrorSchema,
        },
      },
    },
  },
});

const getTableRowsRoute = createRoute({
  method: 'get',
  path: '/database/tables/{tableName}/rows',
  tags: ['Admin - Database'],
  summary: 'Get table rows',
  description: 'Get rows from a table with pagination and filtering. Admin only.',
  request: {
    params: z.object({
      tableName: z.string().openapi({ description: 'Table name', example: 'user' }),
    }),
    query: z.object({
      page: z.string().optional().openapi({ description: 'Page number', example: '1' }),
      limit: z
        .string()
        .optional()
        .openapi({ description: 'Rows per page (max 100)', example: '50' }),
      orderBy: z.string().optional().openapi({ description: 'Column to sort by' }),
      order: z.enum(['asc', 'desc']).optional().openapi({ description: 'Sort order' }),
      filterBy: z.string().optional().openapi({ description: 'Column name to filter by' }),
      filterValue: z.string().optional().openapi({ description: 'Value to match' }),
    }),
  },
  responses: {
    200: {
      description: 'Table rows',
      content: {
        'application/json': {
          schema: TableRowsResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid table name or parameters',
      content: {
        'application/json': {
          schema: DatabaseErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: DatabaseErrorSchema,
        },
      },
    },
  },
});

const pdfsByOrgRoute = createRoute({
  method: 'get',
  path: '/database/analytics/pdfs-by-org',
  tags: ['Admin - Database'],
  summary: 'PDFs by organization',
  description: 'Get PDF count and total storage per organization. Admin only.',
  responses: {
    200: {
      description: 'PDF analytics by organization',
      content: {
        'application/json': {
          schema: z.object({
            analytics: z.array(OrgAnalyticsSchema),
          }),
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: DatabaseErrorSchema,
        },
      },
    },
  },
});

const pdfsByUserRoute = createRoute({
  method: 'get',
  path: '/database/analytics/pdfs-by-user',
  tags: ['Admin - Database'],
  summary: 'PDFs by user',
  description: 'Get uploads by user. Admin only.',
  responses: {
    200: {
      description: 'PDF analytics by user',
      content: {
        'application/json': {
          schema: z.object({
            analytics: z.array(UserAnalyticsSchema),
          }),
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: DatabaseErrorSchema,
        },
      },
    },
  },
});

const pdfsByProjectRoute = createRoute({
  method: 'get',
  path: '/database/analytics/pdfs-by-project',
  tags: ['Admin - Database'],
  summary: 'PDFs by project',
  description: 'Get PDFs per project. Admin only.',
  responses: {
    200: {
      description: 'PDF analytics by project',
      content: {
        'application/json': {
          schema: z.object({
            analytics: z.array(ProjectAnalyticsSchema),
          }),
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: DatabaseErrorSchema,
        },
      },
    },
  },
});

const recentUploadsRoute = createRoute({
  method: 'get',
  path: '/database/analytics/recent-uploads',
  tags: ['Admin - Database'],
  summary: 'Recent uploads',
  description: 'Get recent PDF uploads with user/org context. Admin only.',
  request: {
    query: z.object({
      limit: z
        .string()
        .optional()
        .openapi({ description: 'Number of recent uploads (max 100)', example: '50' }),
    }),
  },
  responses: {
    200: {
      description: 'Recent uploads',
      content: {
        'application/json': {
          schema: z.object({
            uploads: z.array(RecentUploadSchema),
          }),
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: DatabaseErrorSchema,
        },
      },
    },
  },
});

/**
 * GET /api/admin/database/tables
 * List all available tables with row counts
 */
databaseRoutes.openapi(listTablesRoute, async c => {
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
databaseRoutes.openapi(getTableSchemaRoute, async c => {
  const { tableName } = c.req.valid('param');

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
          const refTableName = Object.entries(dbSchema).find(([, t]) => t === refColumn.table)?.[0];
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
 */
databaseRoutes.openapi(getTableRowsRoute, async c => {
  const { tableName } = c.req.valid('param');
  const query = c.req.valid('query');

  const page = parseInt(query.page || '1', 10) || 1;
  const limit = Math.min(Math.max(parseInt(query.limit || '50', 10) || 50, 1), 100);
  const orderByParam = query.orderBy?.trim() || '';
  const order = query.order || 'desc';
  const filterBy = query.filterBy?.trim();
  const filterValue = query.filterValue?.trim();

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
});

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
databaseRoutes.openapi(pdfsByOrgRoute, async c => {
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
databaseRoutes.openapi(pdfsByUserRoute, async c => {
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
databaseRoutes.openapi(pdfsByProjectRoute, async c => {
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
 */
databaseRoutes.openapi(recentUploadsRoute, async c => {
  try {
    const query = c.req.valid('query');
    const limit = Math.min(Math.max(parseInt(query.limit || '50', 10) || 50, 1), 100);
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
});

export { databaseRoutes };
