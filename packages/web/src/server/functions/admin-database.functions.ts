import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import {
  listAdminDatabaseTables,
  getAdminTableSchema,
  getAdminTableRows,
  getAdminPdfsByOrg,
  getAdminPdfsByProject,
  getAdminPdfsByUser,
  getAdminRecentUploads,
} from './admin-database.server';

export const listAdminDatabaseTablesAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { session, db } }) => listAdminDatabaseTables(session, db));

export const getAdminTableSchemaAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ tableName: z.string() }))
  .handler(async ({ data, context: { session } }) => getAdminTableSchema(session, data.tableName));

export const getAdminTableRowsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      tableName: z.string(),
      page: z.number().optional(),
      limit: z.number().optional(),
      orderBy: z.string().optional(),
      order: z.string().optional(),
      filterBy: z.string().optional(),
      filterValue: z.string().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { tableName, ...params } = data;
    return getAdminTableRows(session, db, tableName, params);
  });

export const getAdminPdfsByOrgAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { session, db } }) => getAdminPdfsByOrg(session, db));

export const getAdminPdfsByProjectAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { session, db } }) => getAdminPdfsByProject(session, db));

export const getAdminPdfsByUserAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { session, db } }) => getAdminPdfsByUser(session, db));

export const getAdminRecentUploadsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ limit: z.number().optional() }))
  .handler(async ({ data, context: { session, db } }) => getAdminRecentUploads(session, db, data));
