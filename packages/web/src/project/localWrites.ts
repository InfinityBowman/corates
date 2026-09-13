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

import { syncApp } from '@corates/shared/sync';
import { localTx, standardParse, type LocalTx } from './localCollections';
import { connectionPool } from './ConnectionPool';

type MutatorDefLike = {
  args?: { '~standard': { validate: (v: unknown) => unknown } };
  apply: (tx: LocalTx, args: unknown, ctx: unknown) => void;
};

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
  // runs, and local practice has no principal. A local mutation runs once,
  // so minted ids need only be unique, not reproducible from the seed.
  def.apply(localTx(collections), parsedArgs, {
    clientId: 'local',
    principal: undefined,
    auth: undefined,
    authoritative: false,
    seed: crypto.randomUUID(),
    nextId: () => crypto.randomUUID(),
  });
  connectionPool.scheduleLocalPersist(projectId);
}
