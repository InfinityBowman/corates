import type { Database } from '@corates/db/client';
import { dbSchema, mediaFiles, organization, projects, user } from '@corates/db/schema';
import { and, asc, count, desc, eq, sum } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { isAdminUser } from '@corates/workers/auth-admin';
import { ALLOWED_TABLES, isAllowedTable, type AllowedTableName } from '@/server/lib/dbTables';
import type { Session } from '@/server/middleware/auth';

function assertAdmin(session: Session) {
  if (!isAdminUser(session.user as { role?: string | null })) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' }), {
      status: 403,
    });
  }
}

export async function listAdminDatabaseTables(session: Session, db: Database) {
  assertAdmin(session);

  const tables = await Promise.all(
    ALLOWED_TABLES.map(async tableName => {
      const table = dbSchema[tableName as AllowedTableName];
      if (!table) return null;

      try {
        const result = await db.select({ count: count() }).from(table);
        return { name: tableName, rowCount: result[0]?.count ?? 0 };
      } catch {
        return { name: tableName, rowCount: 0, error: 'Failed to count rows' };
      }
    }),
  );

  return { tables: tables.filter(t => t !== null) };
}

interface DrizzleColumn {
  dataType?: string;
  notNull?: boolean;
  primary?: boolean;
  isUnique?: boolean;
  hasDefault?: boolean;
  config?: { references?: () => { table?: unknown; name?: string } };
}

export function getAdminTableSchema(session: Session, tableName: string) {
  assertAdmin(session);

  if (!isAllowedTable(tableName)) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'table_not_allowed' }), {
      status: 400,
    });
  }

  const table = dbSchema[tableName as AllowedTableName];
  if (!table) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'table_not_found' }), {
      status: 400,
    });
  }

  const columns = Object.entries(table as unknown as Record<string, DrizzleColumn>).map(
    ([name, column]) => {
      const info: {
        name: string;
        type: string;
        notNull: boolean;
        primaryKey: boolean;
        unique: boolean;
        hasDefault: boolean;
        foreignKey?: { table: string; column: string };
      } = {
        name,
        type: column.dataType || 'unknown',
        notNull: column.notNull ?? false,
        primaryKey: column.primary ?? false,
        unique: column.isUnique ?? false,
        hasDefault: column.hasDefault ?? false,
      };

      if (column.config?.references) {
        const refFn = column.config.references;
        try {
          const refColumn = refFn();
          if (refColumn?.table) {
            const refTableName = Object.entries(dbSchema).find(
              ([, t]) => t === refColumn.table,
            )?.[0];
            if (refTableName && (ALLOWED_TABLES as readonly string[]).includes(refTableName)) {
              info.foreignKey = { table: refTableName, column: refColumn.name || '' };
            }
          }
        } catch {
          // skip
        }
      }

      return info;
    },
  );

  return { tableName, columns };
}

async function handleMediaFilesQuery(
  db: Database,
  opts: {
    page: number;
    limit: number;
    orderBy: string;
    order: 'asc' | 'desc';
    filterBy?: string;
    filterValue?: string;
  },
) {
  const { page, limit, orderBy: orderByParam, order, filterBy, filterValue } = opts;
  const offset = (page - 1) * limit;
  const whereConditions = [];

  if (filterBy && filterValue) {
    if (filterBy === 'orgId' || filterBy === 'orgSlug') {
      if (filterBy === 'orgSlug') {
        const org = await db
          .select({ id: organization.id })
          .from(organization)
          .where(eq(organization.slug, filterValue))
          .get();
        if (org) {
          whereConditions.push(eq(mediaFiles.orgId, org.id));
        } else {
          return {
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
          };
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

  const countQuery =
    whereConditions.length > 0 ?
      db
        .select({ count: count() })
        .from(mediaFiles)
        .where(and(...whereConditions))
    : db.select({ count: count() }).from(mediaFiles);
  const countResult = await countQuery;
  const totalRows = countResult[0]?.count ?? 0;

  let orderColumnName = orderByParam || 'createdAt';
  const mediaFilesRecord = mediaFiles as unknown as Record<string, unknown>;
  let orderColumn = mediaFilesRecord[orderColumnName];
  if (!orderColumn) {
    orderColumnName = 'createdAt';
    orderColumn = mediaFiles.createdAt;
  }
  const orderFn = order === 'asc' ? asc : desc;

  const baseQuery = db
    .select({
      id: mediaFiles.id,
      filename: mediaFiles.filename,
      originalName: mediaFiles.originalName,
      fileType: mediaFiles.fileType,
      fileSize: mediaFiles.fileSize,
      bucketKey: mediaFiles.bucketKey,
      createdAt: mediaFiles.createdAt,
      studyId: mediaFiles.studyId,
      orgId: mediaFiles.orgId,
      orgName: organization.name,
      orgSlug: organization.slug,
      projectId: mediaFiles.projectId,
      projectName: projects.name,
      uploadedBy: mediaFiles.uploadedBy,
      uploadedByName: user.name,
      uploadedByEmail: user.email,
      uploadedByGivenName: user.givenName,
    })
    .from(mediaFiles)
    .leftJoin(organization, eq(mediaFiles.orgId, organization.id))
    .leftJoin(projects, eq(mediaFiles.projectId, projects.id))
    .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
    .orderBy(orderFn(orderColumn as never))
    .limit(limit)
    .offset(offset);

  const rows =
    whereConditions.length > 0 ? await baseQuery.where(and(...whereConditions)) : await baseQuery;

  return {
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
  };
}

export async function getAdminTableRows(
  session: Session,
  db: Database,
  tableName: string,
  params: {
    page?: number;
    limit?: number;
    orderBy?: string;
    order?: string;
    filterBy?: string;
    filterValue?: string;
  },
) {
  assertAdmin(session);

  const page = params.page ?? 1;
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const orderByParam = params.orderBy?.trim() || '';
  const order: 'asc' | 'desc' = params.order === 'asc' ? 'asc' : 'desc';
  const filterBy = params.filterBy?.trim() || undefined;
  const filterValue = params.filterValue?.trim() || undefined;

  if (!isAllowedTable(tableName)) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'table_not_allowed' }), {
      status: 400,
    });
  }

  const table = dbSchema[tableName as AllowedTableName];
  if (!table) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'table_not_found' }), {
      status: 400,
    });
  }

  if (tableName === 'mediaFiles') {
    return handleMediaFilesQuery(db, {
      page,
      limit,
      orderBy: orderByParam,
      order,
      filterBy,
      filterValue,
    });
  }

  const offset = (page - 1) * limit;
  const whereConditions = [];
  const tableRecord = table as unknown as Record<string, unknown>;
  if (filterBy && filterValue && tableRecord[filterBy]) {
    whereConditions.push(eq(tableRecord[filterBy] as never, filterValue));
  }

  const countQuery =
    whereConditions.length > 0 ?
      db
        .select({ count: count() })
        .from(table)
        .where(and(...whereConditions))
    : db.select({ count: count() }).from(table);
  const countResult = await countQuery;
  const totalRows = countResult[0]?.count ?? 0;

  const columnNames = Object.keys(table);
  let orderColumnName = orderByParam;
  if (!orderColumnName || !tableRecord[orderColumnName]) {
    orderColumnName = tableRecord['id'] ? 'id' : columnNames[0];
  }
  const orderColumn = tableRecord[orderColumnName];
  const orderFn = order === 'asc' ? asc : desc;

  const rows =
    whereConditions.length > 0 ?
      await db
        .select()
        .from(table)
        .where(and(...whereConditions))
        .orderBy(orderFn(orderColumn as never))
        .limit(limit)
        .offset(offset)
    : await db
        .select()
        .from(table)
        .orderBy(orderFn(orderColumn as never))
        .limit(limit)
        .offset(offset);

  return {
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
  };
}

export async function getAdminPdfsByOrg(session: Session, db: Database) {
  assertAdmin(session);

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

  return {
    analytics: results.map(row => ({
      orgId: row.orgId,
      orgName: row.orgName,
      orgSlug: row.orgSlug,
      pdfCount: Number(row.pdfCount || 0),
      totalStorage: Number(row.totalStorage || 0),
    })),
  };
}

export async function getAdminPdfsByProject(session: Session, db: Database) {
  assertAdmin(session);

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

  return {
    analytics: results.map(row => ({
      projectId: row.projectId,
      projectName: row.projectName,
      orgId: row.orgId,
      orgName: row.orgName,
      orgSlug: row.orgSlug,
      pdfCount: Number(row.pdfCount || 0),
      totalStorage: Number(row.totalStorage || 0),
    })),
  };
}

export async function getAdminPdfsByUser(session: Session, db: Database) {
  assertAdmin(session);

  const results = await db
    .select({
      userId: mediaFiles.uploadedBy,
      userName: user.name,
      userEmail: user.email,
      userGivenName: user.givenName,
      pdfCount: count(mediaFiles.id),
      totalStorage: sum(mediaFiles.fileSize),
    })
    .from(mediaFiles)
    .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
    .groupBy(mediaFiles.uploadedBy, user.name, user.email, user.givenName)
    .orderBy(desc(count(mediaFiles.id)));

  return {
    analytics: results
      .filter(row => row.userId)
      .map(row => ({
        userId: row.userId as string,
        userName: row.userName,
        userEmail: row.userEmail,
        userDisplayName: row.userGivenName,
        pdfCount: Number(row.pdfCount || 0),
        totalStorage: Number(row.totalStorage || 0),
      })),
  };
}

export async function getAdminRecentUploads(
  session: Session,
  db: Database,
  params: { limit?: number },
) {
  assertAdmin(session);

  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);

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
      uploadedByGivenName: user.givenName,
    })
    .from(mediaFiles)
    .leftJoin(organization, eq(mediaFiles.orgId, organization.id))
    .leftJoin(projects, eq(mediaFiles.projectId, projects.id))
    .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
    .orderBy(desc(mediaFiles.createdAt))
    .limit(limit);

  return {
    uploads: results.map(row => ({
      id: row.id,
      filename: row.filename,
      originalName: row.originalName,
      fileSize: row.fileSize,
      createdAt: row.createdAt,
      org: { id: row.orgId, name: row.orgName, slug: row.orgSlug },
      project: { id: row.projectId, name: row.projectName },
      uploadedBy:
        row.uploadedBy ?
          {
            id: row.uploadedBy,
            name: row.uploadedByName,
            email: row.uploadedByEmail,
            givenName: row.uploadedByGivenName,
          }
        : null,
    })),
  };
}
