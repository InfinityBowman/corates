import type { Database } from '@corates/db/client';
import { projects, projectMembers, user, member } from '@corates/db/schema';
import { eq, and, or, desc, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { containsInsensitive } from '@/server/lib/sqlSearch';
import { deleteUserAccount } from '@/server/lib/accountDeletion';
import {
  DomainErrorException,
  createValidationError,
  VALIDATION_ERRORS,
  type ProjectSetupStep,
} from '@corates/shared';

import type { Session } from '@/server/middleware/auth';
import type { OrgId } from '@corates/shared/ids';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';

export interface UserProject {
  id: string;
  name: string;
  orgId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  setupStep: ProjectSetupStep | null;
}

export interface UserProjectWithMemberCount extends UserProject {
  memberCount: number;
}

export interface UserSearchResult {
  id: string;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  username: string | null;
  image: string | null;
  email: string | null;
}

export async function deleteAccount(db: Database, session: Session) {
  await deleteUserAccount(db, { userId: session.user.id, email: session.user.email });
  return { success: true as const, message: 'Account deleted successfully' };
}

export async function fetchMyProjects(db: Database, session: Session) {
  // Second join over the same table: the first is filtered to the caller's own
  // membership (for `role`), this one stays unfiltered so the count covers every
  // member. The (projectId, userId) unique index keeps the count exact.
  const allMembers = alias(projectMembers, 'all_members');

  const results = await db
    .select({
      id: projects.id,
      name: projects.name,
      orgId: projects.orgId,
      role: projectMembers.role,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      setupStep: projects.setupStep,
      memberCount: count(allMembers.id),
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .innerJoin(allMembers, eq(projects.id, allMembers.projectId))
    .where(eq(projectMembers.userId, session.user.id))
    .groupBy(projects.id, projectMembers.role)
    .orderBy(desc(projects.updatedAt));

  return results as unknown as UserProjectWithMemberCount[];
}

export async function searchUsers(
  db: Database,
  session: Session,
  _request: Request,
  params: { q: string; orgId: string; projectId?: string; limit?: number },
) {
  if (!params.q || params.q.length < 2) {
    const error = createValidationError('q', VALIDATION_ERRORS.FIELD_TOO_SHORT.code, params.q);
    error.message = 'Search query must be at least 2 characters';
    throw new DomainErrorException(error);
  }

  // Only people already in the workspace are searchable, so the user table is
  // never enumerable across workspaces. Anyone else is invited by address.
  const orgMembership = await requireOrgMembership(session, db, params.orgId as OrgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const limit = Math.min(params.limit && Number.isFinite(params.limit) ? params.limit : 10, 20);

  let results = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      givenName: user.givenName,
      familyName: user.familyName,
      image: user.image,
    })
    .from(user)
    .innerJoin(member, eq(member.userId, user.id))
    .where(
      and(
        eq(member.organizationId, params.orgId),
        or(
          containsInsensitive(user.email, params.q),
          containsInsensitive(user.name, params.q),
          containsInsensitive(user.givenName, params.q),
          containsInsensitive(user.familyName, params.q),
          containsInsensitive(user.username, params.q),
        ),
      ),
    )
    .limit(limit);

  if (params.projectId) {
    const existingMembers = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, params.projectId));
    const existingUserIds = new Set(existingMembers.map(m => m.userId));
    results = results.filter(u => !existingUserIds.has(u.id));
  }

  results = results.filter(u => u.id !== session.user.id);

  const sanitized: UserSearchResult[] = results.map(u => ({
    id: u.id,
    name: u.name,
    givenName: u.givenName,
    familyName: u.familyName,
    username: u.username,
    image: u.image,
    email: u.email,
  }));

  return sanitized;
}
