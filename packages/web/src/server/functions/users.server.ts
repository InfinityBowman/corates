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
import { eq, or, like, sql, desc } from 'drizzle-orm';
import { syncMemberToDO } from '@corates/workers/project-sync';
import { getProjectDocStub } from '@corates/workers/project-doc-id';
import {
  createDomainError,
  createValidationError,
  AUTH_ERRORS,
  USER_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { checkRateLimit, SEARCH_RATE_LIMIT } from '@/server/rateLimit';
import type { Session } from '@/server/middleware/auth';

export interface UserProject {
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
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

  await Promise.all(
    userProjects.map(({ projectId }) => syncMemberToDO(env, projectId, 'remove', { userId })),
  );

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

  console.log(`Account deleted successfully for user: ${userId}`);

  return { success: true as const, message: 'Account deleted successfully' };
}

export async function fetchMyProjects(db: Database, session: Session) {
  const results = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      orgId: projects.orgId,
      role: projectMembers.role,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .where(eq(projectMembers.userId, session.user.id))
    .orderBy(desc(projects.updatedAt));

  return results as unknown as UserProject[];
}

export async function fetchUserProjects(db: Database, session: Session, userId: string) {
  if (session.user.id !== userId) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'view_other_user_projects' }),
      { status: 403 },
    );
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
  request: Request,
  params: { q: string; projectId?: string; limit?: number },
) {
  const rate = checkRateLimit(request, env, SEARCH_RATE_LIMIT);
  if (rate.blocked) throw rate.blocked;

  if (!params.q || params.q.length < 2) {
    const error = createValidationError('q', VALIDATION_ERRORS.FIELD_TOO_SHORT.code, params.q);
    error.message = 'Search query must be at least 2 characters';
    throw Response.json(error, { status: 400 });
  }

  const limit = Math.min(params.limit && Number.isFinite(params.limit) ? params.limit : 10, 20);
  const searchPattern = `%${params.q.toLowerCase()}%`;

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
        like(sql`lower(${user.email})`, searchPattern),
        like(sql`lower(${user.name})`, searchPattern),
        like(sql`lower(${user.givenName})`, searchPattern),
        like(sql`lower(${user.familyName})`, searchPattern),
        like(sql`lower(${user.username})`, searchPattern),
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

export async function syncProfile(db: Database, session: Session) {
  const [userData] = await db
    .select({
      name: user.name,
      givenName: user.givenName,
      familyName: user.familyName,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!userData) {
    throw Response.json(createDomainError(USER_ERRORS.NOT_FOUND, { userId: session.user.id }), {
      status: 404,
    });
  }

  const userProjects = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, session.user.id));

  const results = await Promise.all(
    userProjects.map(async ({ projectId }) => {
      try {
        const projectDoc = getProjectDocStub(env, projectId);
        await projectDoc.syncMember('update', {
          userId: session.user.id,
          name: userData.name,
          givenName: userData.givenName,
          familyName: userData.familyName,
          image: userData.image,
        });
        return { projectId, success: true };
      } catch (err) {
        console.error(`Failed to sync profile to project ${projectId}:`, err);
        return { projectId, success: false };
      }
    }),
  );

  const successCount = results.filter(r => r.success).length;

  return {
    success: true as const,
    synced: successCount,
    total: userProjects.length,
  };
}
