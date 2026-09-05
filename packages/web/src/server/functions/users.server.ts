import { info } from '@corates/workers/logger';
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
import { eq, or, desc, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { containsInsensitive } from '@/server/lib/sqlSearch';
import { kickWorkspaceUser } from '@corates/workers/sync';
import {
  throwDomainError,
  DomainErrorException,
  createValidationError,
  AUTH_ERRORS,
  VALIDATION_ERRORS,
  type ProjectSetupStep,
} from '@corates/shared';

import type { Session } from '@/server/middleware/auth';

export interface UserProject {
  id: string;
  name: string;
  description: string | null;
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

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = local.length > 2 ? local.slice(0, 2) + '***' : local + '***';
  return `${masked}@${domain}`;
}

export async function deleteAccount(db: Database, session: Session) {
  const userId = session.user.id;

  const userProjects = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));

  // Kick the user's live sync sessions before their memberships disappear;
  // reconnect attempts re-run authorize against D1 and fail permanently.
  await Promise.all(userProjects.map(({ projectId }) => kickWorkspaceUser(env, projectId, userId)));

  await db.batch([
    db.update(mediaFiles).set({ uploadedBy: null }).where(eq(mediaFiles.uploadedBy, userId)),
    db.delete(projectMembers).where(eq(projectMembers.userId, userId)),
    db.delete(projects).where(eq(projects.createdBy, userId)),
    db.delete(twoFactor).where(eq(twoFactor.userId, userId)),
    db.delete(sessionTable).where(eq(sessionTable.userId, userId)),
    db.delete(account).where(eq(account.userId, userId)),
    db.delete(verification).where(eq(verification.identifier, session.user.email)),
    db.delete(user).where(eq(user.id, userId)),
  ]);

  info(`Account deleted successfully for user: ${userId}`);

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
      description: projects.description,
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

export async function fetchUserProjects(db: Database, session: Session, userId: string) {
  if (session.user.id !== userId) {
    throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'view_other_user_projects' });
  }

  const results = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      orgId: projects.orgId,
      role: projectMembers.role,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      setupStep: projects.setupStep,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .where(eq(projectMembers.userId, userId))
    .orderBy(desc(projects.updatedAt));

  return results as unknown as UserProject[];
}

export async function searchUsers(
  db: Database,
  session: Session,
  _request: Request,
  params: { q: string; projectId?: string; limit?: number },
) {
  if (!params.q || params.q.length < 2) {
    const error = createValidationError('q', VALIDATION_ERRORS.FIELD_TOO_SHORT.code, params.q);
    error.message = 'Search query must be at least 2 characters';
    throw new DomainErrorException(error);
  }

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
    .where(
      or(
        containsInsensitive(user.email, params.q),
        containsInsensitive(user.name, params.q),
        containsInsensitive(user.givenName, params.q),
        containsInsensitive(user.familyName, params.q),
        containsInsensitive(user.username, params.q),
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
    email: params.q.includes('@') ? u.email : maskEmail(u.email),
  }));

  return sanitized;
}
