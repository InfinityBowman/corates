/**
 * Admin database table schema
 *
 * GET /api/admin/database/tables/:tableName/schema — column metadata + foreign
 * key references for a whitelisted table. Reads Drizzle's runtime column shape.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { dbSchema } from '@corates/db/schema';
import { createValidationError, VALIDATION_ERRORS } from '@corates/shared';
import { requireAdmin } from '@/server/guards/requireAdmin';
import { ALLOWED_TABLES, isAllowedTable, type AllowedTableName } from '@/server/lib/dbTables';

interface ColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  unique: boolean;
  hasDefault: boolean;
  foreignKey?: { table: string; column: string };
}

interface DrizzleColumn {
  dataType?: string;
  notNull?: boolean;
  primary?: boolean;
  isUnique?: boolean;
  hasDefault?: boolean;
  config?: { references?: () => { table?: unknown; name?: string } };
}

type HandlerArgs = { request: Request; params: { tableName: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { tableName } = params;

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

  const columns: ColumnInfo[] = Object.entries(
    table as unknown as Record<string, DrizzleColumn>,
  ).map(([name, column]) => {
    const info: ColumnInfo = {
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
          const refTableName = Object.entries(dbSchema).find(([, t]) => t === refColumn.table)?.[0];
          if (refTableName && (ALLOWED_TABLES as readonly string[]).includes(refTableName)) {
            info.foreignKey = { table: refTableName, column: refColumn.name || '' };
          }
        }
      } catch {
        // skip
      }
    }

    return info;
  });

  return Response.json({ tableName, columns }, { status: 200 });
};

export const Route = createFileRoute('/api/admin/database/tables/$tableName/schema')({
  server: { handlers: { GET: handleGet } },
});
