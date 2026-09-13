/**
 * Local practice has no engine workspace, so nothing runs the app's schema
 * migrations over its rows on wake. This module does what the Durable Object
 * does: replay `migrationPath` from the stored schema version, validate the
 * net rows against the current schema, and restamp. Every migration written
 * once in `@corates/shared/sync` then applies here unchanged.
 */

import { migrationPath, syncApp, type MigrationTx } from '@corates/shared/sync';
import { LOCAL_REVIEWER_ID } from './localProject';
import {
  LOCAL_TABLES,
  validateLocalRow,
  type LocalRows,
  type LocalTable,
  type MigratedLocalRows,
} from './localCollections';

type Row = Record<string, unknown>;
type Tables = Map<LocalTable, Map<string, Row>>;

/** The persisted local project as the pool reads it. */
export interface StoredLocalRows {
  /** Absent on rows persisted before local practice tracked the schema version. */
  schemaVersion?: number;
  rows: LocalRows;
}

export function migrateLocalRows(stored: StoredLocalRows): {
  schemaVersion: number;
  rows: MigratedLocalRows;
} {
  const tables: Tables = new Map();
  for (const table of LOCAL_TABLES) {
    const rows = (stored.rows[table] ?? []) as Row[];
    tables.set(table, new Map(rows.map(row => [row.id as string, row])));
  }

  let from = stored.schemaVersion;
  if (from === undefined) {
    normalizeUnstamped(tables);
    from = 1;
  }

  const tx: MigrationTx = {
    get: (tbl, id) => tables.get(tbl as LocalTable)?.get(id) ?? null,
    list: tbl =>
      [...(tables.get(tbl as LocalTable) ?? new Map<string, Row>())].map(([id, data]) => ({
        id,
        data,
      })),
    put: (tbl, id, data) => {
      let rows = tables.get(tbl as LocalTable);
      if (!rows) {
        rows = new Map();
        tables.set(tbl as LocalTable, rows);
      }
      rows.set(id, data);
    },
    del: (tbl, id) => {
      tables.get(tbl as LocalTable)?.delete(id);
    },
  };
  for (const step of migrationPath(syncApp, from)) step.migrate?.(tx);

  const rows = {} as MigratedLocalRows;
  for (const table of LOCAL_TABLES) {
    rows[table] = [...tables.get(table)!.values()].map(row => validateLocalRow(table, row));
  }
  return { schemaVersion: syncApp.version, rows };
}

/**
 * Unstamped rows are version 1 rows from a plane that never named its
 * reviewer: practice checklists were unassigned, which the version 2 step
 * would read as consensus. Give them the local reviewer first, and the
 * study its slot, so the shared migrations see the shape online data has.
 * A consensus row from before `kind` is recognisable by status alone.
 */
function normalizeUnstamped(tables: Tables): void {
  const studies = tables.get('studies')!;
  for (const [id, study] of studies) {
    if (!study.reviewer1) studies.set(id, { ...study, reviewer1: LOCAL_REVIEWER_ID });
  }
  const checklists = tables.get('checklists')!;
  for (const [id, checklist] of checklists) {
    const consensus =
      checklist.kind === 'consensus' ||
      (checklist.kind === undefined &&
        (checklist.status === 'reconciling' || checklist.status === 'finalized'));
    if (!consensus && checklist.assignedTo == null) {
      checklists.set(id, { ...checklist, assignedTo: LOCAL_REVIEWER_ID });
    }
  }
}
