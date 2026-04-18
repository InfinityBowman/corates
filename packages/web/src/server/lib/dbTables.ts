/**
 * Whitelist of tables admin viewers can read. Mirrors the list in the legacy
 * Hono `routes/admin/database.ts`. Used by the migrated TanStack admin/database
 * routes to gate access — no raw SQL is ever accepted, only these table names.
 */
export const ALLOWED_TABLES = [
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
] as const;

export type AllowedTableName = (typeof ALLOWED_TABLES)[number];

export function isAllowedTable(name: string): name is AllowedTableName {
  return (ALLOWED_TABLES as readonly string[]).includes(name);
}
