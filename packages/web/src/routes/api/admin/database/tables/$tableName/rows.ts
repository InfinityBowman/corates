/**
 * Admin database table rows
 *
 * GET /api/admin/database/tables/:tableName/rows — paginated, sortable,
 * optionally-filtered rows from a whitelisted table. mediaFiles takes a
 * dedicated path that joins org/project/user for readability.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { dbSchema, mediaFiles, organization, projects, user } from '@corates/db/schema';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';
import { isAllowedTable, type AllowedTableName } from '@/server/lib/dbTables';

interface MediaFilesQueryOptions {
  page: number;
  limit: number;
  orderBy: string;
  order: 'asc' | 'desc';
  filterBy?: string;
  filterValue?: string;
}

async function handleMediaFilesQuery({
  page,
  limit,
  orderBy: orderByParam,
  order,
  filterBy,
  filterValue,
}: MediaFilesQueryOptions): Promise<Response> {
  try {
    const db = createDb(env.DB);
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
            return Response.json({
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

    return Response.json({
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
  } catch (err) {
    const error = err as Error;
    console.error('MediaFiles query error:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_mediafiles_rows',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
}

type HandlerArgs = { request: Request; params: { tableName: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { tableName } = params;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10) || 1;
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100);
  const orderByParam = url.searchParams.get('orderBy')?.trim() || '';
  const orderRaw = url.searchParams.get('order') || 'desc';
  const order: 'asc' | 'desc' = orderRaw === 'asc' ? 'asc' : 'desc';
  const filterBy = url.searchParams.get('filterBy')?.trim() || undefined;
  const filterValue = url.searchParams.get('filterValue')?.trim() || undefined;

  if (!isAllowedTable(tableName)) {
    return Response.json(
      createValidationError(
        'tableName',
        VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code,
        tableName,
        'allowed_table',
      ),
      { status: 400 },
    );
  }

  const table = dbSchema[tableName as AllowedTableName];
  if (!table) {
    return Response.json(
      createValidationError(
        'tableName',
        VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code,
        tableName,
        'schema_lookup',
      ),
      { status: 400 },
    );
  }

  if (tableName === 'mediaFiles') {
    return handleMediaFilesQuery({
      page,
      limit,
      orderBy: orderByParam,
      order,
      filterBy,
      filterValue,
    });
  }

  try {
    const db = createDb(env.DB);
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

    return Response.json(
      {
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
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Database rows fetch error:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_table_rows',
        tableName,
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/database/tables/$tableName/rows')({
  server: { handlers: { GET: handleGet } },
});
