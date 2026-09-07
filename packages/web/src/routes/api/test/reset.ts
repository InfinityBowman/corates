/**
 * POST /api/test/reset
 *
 * Drops every application table and recreates the schema from the migration
 * files, so e2e runs start from a clean slate regardless of what state the
 * local database was left in. DEV_MODE only.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { devModeGate } from '@/server/devModeGate';
import { MIGRATION_SQL } from '@/__tests__/server/migration-sql';
import { captureError } from '@corates/workers/logger';

function parseSqlStatements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export const handler = async () => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    // Discover tables from the catalog rather than a hand-kept list, which
    // went stale every time a migration added a table. `_cf_*` is D1's own,
    // and `d1_migrations` is wrangler's record of applied migrations: dropping
    // it makes the next `d1 migrations apply` re-run every file and fail.
    const { results: tables } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name <> 'd1_migrations'",
    ).all<{ name: string }>();

    await env.DB.prepare('PRAGMA foreign_keys = OFF').run();
    for (const { name } of tables) {
      await env.DB.prepare(`DROP TABLE IF EXISTS \`${name}\``).run();
    }

    // Migrations only ever run against an empty database here, so ALTER TABLE
    // steps that would fail on a re-run (ADD or DROP COLUMN) are safe.
    for (const stmt of parseSqlStatements(MIGRATION_SQL)) {
      await env.DB.prepare(stmt).run();
    }
    await env.DB.prepare('PRAGMA foreign_keys = ON').run();

    return Response.json({ success: true, tablesDropped: tables.length });
  } catch (err) {
    captureError(err, { tags: { component: 'test-routes', action: 'reset' } });
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/test/reset')({
  server: { handlers: { POST: handler } },
});
