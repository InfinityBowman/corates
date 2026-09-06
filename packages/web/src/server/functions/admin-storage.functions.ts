import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import { listAdminStorageDocuments, deleteAdminStorageDocuments } from './admin-storage.server';

export const listAdminStorageDocumentsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      cursor: z.string().optional(),
      limit: z.number().optional(),
      prefix: z.string().optional(),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) =>
    listAdminStorageDocuments(session, db, data),
  );

export const deleteAdminStorageDocumentsAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ keys: z.array(z.string()) }))
  .handler(async ({ data, context: { session } }) => deleteAdminStorageDocuments(session, data));
