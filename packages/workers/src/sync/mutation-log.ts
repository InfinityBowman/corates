/**
 * `sync.mutation` lines from the engine's post-commit hook: the server-side
 * record that appraisal work happened in a project. Names and tables only,
 * never args or row values, because answers are research data.
 */

import type { MutationCommitted } from '@cf-sync/server';

export const COALESCE_WINDOW_MS = 60_000;

// Per-field-edit mutators would emit hundreds of lines per checklist pass, so
// they fold into one line per user, mutation and checklist per window.
const COALESCED = new Set([
  'checklist.updateAnswer',
  'checklist.setText',
  'annotation.add',
  'annotation.update',
  'annotation.delete',
  'reconciliation.saveProgress',
]);

export type MutationLogLine = {
  projectId: string;
  name: string;
  userId?: string;
  tables: string[];
  rowCount: number;
  version: number;
  /** Mutations folded into this line; 1 unless the mutator is coalesced. */
  count: number;
};

interface Window {
  line: MutationLogLine;
  tables: Set<string>;
}

function checklistIdOf(args: unknown): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const id = (args as { checklistId?: unknown }).checklistId;
  return typeof id === 'string' ? id : undefined;
}

export function createMutationLogger(
  log: (line: MutationLogLine) => void,
  windowMs = COALESCE_WINDOW_MS,
): (event: MutationCommitted) => void | Promise<void> {
  const windows = new Map<string, Window>();

  return event => {
    const tables = new Set(event.changes.map(c => c.tbl));
    const line: MutationLogLine = {
      projectId: event.workspaceId,
      name: event.name,
      userId: event.principal,
      tables: [...tables],
      rowCount: event.changes.length,
      version: event.version,
      count: 1,
    };

    if (!COALESCED.has(event.name)) {
      log(line);
      return;
    }

    const key = [event.workspaceId, event.principal, event.name, checklistIdOf(event.args)].join(
      '|',
    );
    const open = windows.get(key);
    if (open) {
      open.line.count += 1;
      open.line.rowCount += line.rowCount;
      open.line.version = line.version;
      for (const tbl of tables) open.tables.add(tbl);
      return;
    }

    const window: Window = { line, tables };
    windows.set(key, window);
    // The engine holds this promise with waitUntil, keeping the DO alive to flush.
    return new Promise(resolve => {
      setTimeout(() => {
        windows.delete(key);
        log({ ...window.line, tables: [...window.tables] });
        resolve();
      }, windowMs);
    });
  };
}
