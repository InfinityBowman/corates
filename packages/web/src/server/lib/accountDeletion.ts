/**
 * Delete a user and every project only they belong to, including the
 * project's workspace content and R2 PDFs. Shared by self-service and admin
 * account deletion.
 *
 * Projects the user created but shares with others survive: they pass to
 * another owner, or the longest-standing member is promoted. Deleting a
 * shared review because one reviewer left would destroy other people's work.
 */

import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import {
  projects,
  projectMembers,
  user,
  session as sessionTable,
  account,
  verification,
  twoFactor,
  mediaFiles,
} from '@corates/db/schema';
import { and, asc, eq, ne } from 'drizzle-orm';
import { captureError, info } from '@corates/workers/logger';
import { cleanupProjectStorage } from '@corates/workers/commands/projects';
import {
  kickWorkspaceUser,
  refreshWorkspaceSessions,
  teardownWorkspace,
} from '@corates/workers/sync';

interface Handoff {
  projectId: string;
  successorId: string;
  promote: boolean;
}

export async function deleteUserAccount(
  db: Database,
  { userId, email }: { userId: string; email: string },
) {
  const memberships = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));

  const created = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.createdBy, userId));

  const soleProjects: string[] = [];
  const handoffs: Handoff[] = [];
  for (const { id } of created) {
    const others = await db
      .select({ userId: projectMembers.userId, role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), ne(projectMembers.userId, userId)))
      .orderBy(asc(projectMembers.joinedAt), asc(projectMembers.id));
    if (others.length === 0) {
      soleProjects.push(id);
      continue;
    }
    const successor = others.find(m => m.role === 'owner') ?? others[0];
    handoffs.push({
      projectId: id,
      successorId: successor.userId,
      promote: successor.role !== 'owner',
    });
  }

  // Kick the user's live sync sessions before their memberships disappear;
  // reconnect attempts re-run authorize against D1 and fail permanently.
  await Promise.all(memberships.map(({ projectId }) => kickWorkspaceUser(env, projectId, userId)));

  // Same order as deleteProject: PDFs first, then the authoritative D1 delete,
  // then the workspace wipe so a failed delete leaves the project intact.
  for (const projectId of soleProjects) {
    try {
      await cleanupProjectStorage(env, projectId);
    } catch (err) {
      captureError(err, {
        tags: { component: 'account', action: 'delete-r2-cleanup' },
        extra: { userId, projectId },
      });
    }
  }

  await db.batch([
    db.update(mediaFiles).set({ uploadedBy: null }).where(eq(mediaFiles.uploadedBy, userId)),
    db.delete(projectMembers).where(eq(projectMembers.userId, userId)),
    ...handoffs.map(h =>
      db.update(projects).set({ createdBy: h.successorId }).where(eq(projects.id, h.projectId)),
    ),
    ...handoffs
      .filter(h => h.promote)
      .map(h =>
        db
          .update(projectMembers)
          .set({ role: 'owner' })
          .where(
            and(
              eq(projectMembers.projectId, h.projectId),
              eq(projectMembers.userId, h.successorId),
            ),
          ),
      ),
    db.delete(projects).where(eq(projects.createdBy, userId)),
    db.delete(twoFactor).where(eq(twoFactor.userId, userId)),
    db.delete(sessionTable).where(eq(sessionTable.userId, userId)),
    db.delete(account).where(eq(account.userId, userId)),
    db.delete(verification).where(eq(verification.identifier, email)),
    db.delete(user).where(eq(user.id, userId)),
  ]);

  for (const projectId of soleProjects) {
    await teardownWorkspace(env, projectId);
  }
  // Reconnects pick up the successor's owner stamp and refetch the member list.
  for (const { projectId } of handoffs) {
    await refreshWorkspaceSessions(env, projectId);
  }

  info('account.deleted', {
    userId,
    deletedProjects: soleProjects.length,
    transferredProjects: handoffs.length,
  });
}
