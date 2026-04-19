/**
 * Admin database tables list
 *
 * GET /api/admin/database/tables — row counts for each whitelisted table. Used
 * by the admin database viewer.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { dbSchema } from '@corates/db/schema';
import { count } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { adminMiddleware } from '@/server/middleware/admin';
import { ALLOWED_TABLES, type AllowedTableName } from '@/server/lib/dbTables';

export const handleGet = async () => {
  try {
    const db = createDb(env.DB);

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

    return Response.json({ tables: tables.filter(t => t !== null) }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Database tables list error:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        message: 'Failed to list database tables',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/database/tables')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
