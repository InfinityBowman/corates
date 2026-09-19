/**
 * The one app definition both sides consume: `createWorkspaceDO(syncApp)` in
 * the worker, `new SyncClient({ app: syncApp, ... })` in the browser. Version 1
 * is the migration baseline — the transformer imports Y.Doc exports as
 * version-1 rows and the chain in `migrations.ts` carries them forward.
 */

import { defineApp } from '@cf-sync/protocol';
import { syncMigrations } from './migrations.js';
import { syncMutators } from './mutators.js';
import { presenceSchema } from './presence.js';
import { syncSchema } from './schema.js';

export const syncApp = defineApp({
  version: 2,
  schema: syncSchema,
  mutators: syncMutators,
  migrations: syncMigrations,
  // Presence is never stored, so declaring (or changing) it needs no
  // version bump.
  presence: presenceSchema,
});

export type SyncApp = typeof syncApp;
