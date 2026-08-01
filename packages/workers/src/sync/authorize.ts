/**
 * Connection-time authorization for the sync workspace (one workspace per
 * project). Runs in the worker before the DO is reached, and is the only
 * place the sync plane touches D1: the verdict's stamps travel with the
 * socket, and mutators read them synchronously (`@corates/shared/sync`
 * enforces `writeAllowed` in every mutator).
 *
 * One authority per fact: D1 owns identity, membership, and billing. The
 * workspace never mirrors them — staleness is bounded by connection lifetime
 * and closed by forced disconnect (member removal kicks, subscription changes
 * refresh; see ./workspace.ts).
 */

import { and, eq } from 'drizzle-orm';
import type { Database } from '@corates/db/client';
import { projectMembers, projects } from '@corates/db/schema';
import type { SyncAuthContext } from '@corates/shared/sync';
import { resolveOrgAccess } from '../lib/billingResolver';

export type SyncVerdict =
  | { ok: true; principal: string; context: SyncAuthContext }
  | { ok: false; reason: 'project-not-found' | 'not-a-member' };

/**
 * Membership + entitlement for one (user, project) pair, as authorize stamps.
 * The billing gate mirrors `requireOrgWriteAccess`: only `readOnly` blocks
 * writes — `free` and `full` both pass. This exceeds the old plane, where the
 * Yjs socket had no billing gate at all.
 */
export async function buildSyncVerdict(
  db: Database,
  userId: string,
  projectId: string,
): Promise<SyncVerdict> {
  const project = await db
    .select({ orgId: projects.orgId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();
  if (!project) return { ok: false, reason: 'project-not-found' };

  const membership = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .get();
  if (!membership) return { ok: false, reason: 'not-a-member' };

  const billing = await resolveOrgAccess(db, project.orgId);

  return {
    ok: true,
    principal: userId,
    context: {
      role: membership.role === 'owner' ? 'owner' : 'member',
      writeAllowed: billing.accessMode !== 'readOnly',
    },
  };
}
