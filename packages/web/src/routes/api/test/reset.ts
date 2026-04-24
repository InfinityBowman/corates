/**
 * POST /api/test/reset
 *
 * Ensures all tables exist (runs migrations), then wipes all data.
 * Used by e2e tests to guarantee a clean slate on every run,
 * including against a fresh database. DEV_MODE only.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { devModeGate } from '@/server/devModeGate';
import { MIGRATION_SQL } from '@/__tests__/server/migration-sql';

function parseSqlStatements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

const TABLES_IN_DELETE_ORDER = [
  'stripe_event_ledger',
  'org_access_grants',
  'project_invitations',
  'mediaFiles',
  'project_members',
  'projects',
  'subscription',
  'invitation',
  'twoFactor',
  'verification',
  'session',
  'account',
  'member',
  'organization',
  'user',
];

export const handler = async () => {
  const gated = devModeGate(env);
  if (gated) return gated;

  try {
    // Ensure all tables exist (idempotent - uses CREATE TABLE / CREATE INDEX)
    const statements = parseSqlStatements(MIGRATION_SQL);
    for (const stmt of statements) {
      try {
        await env.DB.prepare(stmt).run();
      } catch (err) {
        const msg = (err as Error).message || '';
        if (!msg.includes('already exists')) throw err;
      }
    }

    // Truncate all tables
    await env.DB.prepare('PRAGMA foreign_keys = OFF').run();
    for (const table of TABLES_IN_DELETE_ORDER) {
      await env.DB.prepare(`DELETE FROM \`${table}\``).run();
    }
    await env.DB.prepare('PRAGMA foreign_keys = ON').run();

    return Response.json({ success: true, tablesCleared: TABLES_IN_DELETE_ORDER.length });
  } catch (err) {
    console.error('[test-reset] Error:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/test/reset')({
  server: { handlers: { POST: handler } },
});
