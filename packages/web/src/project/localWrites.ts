/**
 * Local practice writes: the shared mutator functions applied directly to the
 * local-only collections — no socket, no outbox, no Y.Doc. The same
 * `defineMutators` registry the server runs authoritatively runs here
 * locally, so local practice and online projects share one write vocabulary
 * and one validation story.
 *
 * Persistence is Dexie (`localProjects`): the pool subscribes to the
 * collections and saves rows debounced; this module only mutates.
 */

import { syncApp, syncSchema } from '@corates/shared/sync';
import type { ProjectCollections } from './localCollections';
import { connectionPool } from './ConnectionPool';

type MutatorDefLike = {
  args?: { '~standard': { validate: (v: unknown) => unknown } };
  apply: (tx: LocalTx, args: unknown, ctx: unknown) => void;
};

interface LocalTx {
  get(tbl: string, id: string): unknown;
  list(tbl: string): Array<{ id: string; data: unknown }>;
  put(tbl: string, id: string, data: unknown): void;
  del(tbl: string, id: string): void;
}

function standardParse(schema: { '~standard': { validate: (v: unknown) => unknown } }, value: unknown): unknown {
  const result = schema['~standard'].validate(value) as {
    value?: unknown;
    issues?: Array<{ message: string }>;
  };
  if (result.issues) {
    throw new Error(`local mutation validation failed: ${result.issues[0]?.message ?? 'invalid'}`);
  }
  return result.value;
}

function makeTx(collections: ProjectCollections): LocalTx {
  const cols = collections as unknown as Record<
    string,
    {
      get(id: string): unknown;
      has(id: string): boolean;
      insert(row: unknown): void;
      delete(id: string): void;
      toArray: Array<{ id: string }>;
    }
  >;
  return {
    get: (tbl, id) => cols[tbl]?.get(id) ?? null,
    list: tbl => (cols[tbl]?.toArray ?? []).map(row => ({ id: row.id, data: row })),
    put: (tbl, id, data) => {
      const tableSchema = (syncSchema.tables as Record<string, { '~standard': { validate: (v: unknown) => unknown } }>)[tbl];
      const validated = tableSchema ? standardParse(tableSchema, data) : data;
      const col = cols[tbl];
      if (!col) return;
      if (col.has(id)) col.delete(id);
      col.insert(validated);
    },
    del: (tbl, id) => {
      const col = cols[tbl];
      if (col?.has(id)) col.delete(id);
    },
  };
}

/**
 * Run one named mutation against a local project's collections. Args are
 * validated by the mutator's schema exactly as the server would; guard
 * failures throw (an AppError from the shared registry). Reads inside the
 * mutator see its earlier writes because local-only collections apply
 * synchronously.
 */
export function applyLocalMutation(projectId: string, name: string, args: unknown): void {
  const collections = connectionPool.getCollections(projectId);
  if (!collections) {
    throw new Error(`applyLocalMutation: no local collections for ${projectId}`);
  }
  const def = (syncApp.mutators as Record<string, MutatorDefLike>)[name];
  if (!def) throw new Error(`applyLocalMutation: unknown mutator ${name}`);

  const parsedArgs = def.args ? standardParse(def.args, args) : args;
  // Non-authoritative ctx: the write gate only enforces on authoritative
  // runs, and local practice has no principal.
  def.apply(makeTx(collections), parsedArgs, {
    clientId: 'local',
    principal: undefined,
    auth: undefined,
    authoritative: false,
  });
  connectionPool.scheduleLocalPersist(projectId);
}
