import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import {
  user,
  session as sessionTable,
  projects,
  projectMembers,
  account,
  verification,
  twoFactor,
  mediaFiles,
  member,
  organization,
} from '@corates/db/schema';
import { count, desc, eq, like, or, sql } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  AUTH_ERRORS,
  USER_ERRORS,
  VALIDATION_ERRORS,
  getPlan,
  getGrantPlan,
  type GrantType,
} from '@corates/shared';
import { isAdminUser } from '@corates/workers/auth-admin';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import { syncMemberToDO } from '@corates/workers/project-sync';
import { createAuth } from '@corates/workers/auth-config';
import type { Session } from '@/server/middleware/auth';

function assertAdmin(session: Session) {
  if (!isAdminUser(session.user as { role?: string | null })) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' }),
      { status: 403 },
    );
  }
}

export async function listAdminUsers(
  session: Session,
  db: Database,
  params: { page?: number; limit?: number; search?: string },
) {
  assertAdmin(session);

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const search = params.search?.trim() || undefined;
  const offset = (page - 1) * limit;

  const searchCondition =
    search ?
      or(
        like(sql`lower(${user.email})`, `%${search.toLowerCase()}%`),
        like(sql`lower(${user.name})`, `%${search.toLowerCase()}%`),
        like(sql`lower(${user.givenName})`, `%${search.toLowerCase()}%`),
        like(sql`lower(${user.familyName})`, `%${search.toLowerCase()}%`),
        like(sql`lower(${user.username})`, `%${search.toLowerCase()}%`),
      )
    : undefined;

  const [totalResult] = await db.select({ count: count() }).from(user).where(searchCondition);

  const selectFields = {
    id: user.id,
    name: user.name,
    email: user.email,
    givenName: user.givenName,
    familyName: user.familyName,
    username: user.username,
    image: user.image,
    avatarUrl: user.avatarUrl,
    role: user.role,
    emailVerified: user.emailVerified,
    banned: user.banned,
    banReason: user.banReason,
    banExpires: user.banExpires,
    stripeCustomerId: user.stripeCustomerId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  const users =
    searchCondition ?
      await db
        .select(selectFields)
        .from(user)
        .where(searchCondition)
        .orderBy(desc(user.createdAt))
        .limit(limit)
        .offset(offset)
    : await db
        .select(selectFields)
        .from(user)
        .orderBy(desc(user.createdAt))
        .limit(limit)
        .offset(offset);

  const userIds = users.map(u => u.id);
  let accountsMap: Record<string, string[]> = {};

  if (userIds.length > 0) {
    const accounts = await db
      .select({ userId: account.userId, providerId: account.providerId })
      .from(account)
      .where(
        sql`${account.userId} IN (${sql.join(
          userIds.map(id => sql`${id}`),
          sql`, `,
        )})`,
      );

    accountsMap = accounts.reduce(
      (acc, a) => {
        if (!acc[a.userId]) acc[a.userId] = [];
        acc[a.userId].push(a.providerId);
        return acc;
      },
      {} as Record<string, string[]>,
    );
  }

  const usersWithProviders = users.map(u => ({
    ...u,
    providers: accountsMap[u.id] || [],
  }));

  return {
    users: usersWithProviders,
    pagination: {
      page,
      limit,
      total: totalResult?.count || 0,
      totalPages: Math.ceil((totalResult?.count || 0) / limit),
    },
  };
}

export async function getAdminUserDetails(session: Session, db: Database, userId: string) {
  assertAdmin(session);

  const [userData] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!userData) {
    throw Response.json(createDomainError(USER_ERRORS.NOT_FOUND, { userId }), { status: 404 });
  }

  const userProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      role: projectMembers.role,
      joinedAt: projectMembers.joinedAt,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));

  const userSessions = await db
    .select({
      id: sessionTable.id,
      createdAt: sessionTable.createdAt,
      expiresAt: sessionTable.expiresAt,
      ipAddress: sessionTable.ipAddress,
      userAgent: sessionTable.userAgent,
    })
    .from(sessionTable)
    .where(eq(sessionTable.userId, userId))
    .orderBy(desc(sessionTable.createdAt));

  const linkedAccounts = await db
    .select({
      id: account.id,
      providerId: account.providerId,
      accountId: account.accountId,
      createdAt: account.createdAt,
    })
    .from(account)
    .where(eq(account.userId, userId))
    .orderBy(desc(account.createdAt));

  const orgMemberships = await db
    .select({
      orgId: member.organizationId,
      role: member.role,
      createdAt: member.createdAt,
      orgName: organization.name,
      orgSlug: organization.slug,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(desc(member.createdAt));

  const orgsWithBilling = await Promise.all(
    orgMemberships.map(async m => {
      const orgBilling = await resolveOrgAccess(db, m.orgId);
      const effectivePlan =
        orgBilling.source === 'grant' ?
          getGrantPlan(orgBilling.effectivePlanId as GrantType)
        : getPlan(orgBilling.effectivePlanId);

      return {
        orgId: m.orgId,
        orgName: m.orgName,
        orgSlug: m.orgSlug,
        role: m.role,
        membershipCreatedAt: m.createdAt,
        billing: {
          effectivePlanId: orgBilling.effectivePlanId,
          source: orgBilling.source,
          accessMode: orgBilling.accessMode,
          planName: effectivePlan.name,
        },
      };
    }),
  );

  return {
    user: userData,
    projects: userProjects,
    sessions: userSessions,
    accounts: linkedAccounts,
    orgs: orgsWithBilling,
  };
}

export async function deleteAdminUser(session: Session, db: Database, userId: string) {
  assertAdmin(session);

  if (session.user.id === userId) {
    throw Response.json(
      createValidationError(
        'userId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        userId,
        'cannot_delete_self',
      ),
      { status: 400 },
    );
  }

  const [userToDelete] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId));
  if (!userToDelete) {
    throw Response.json(createDomainError(USER_ERRORS.NOT_FOUND, { userId }), { status: 404 });
  }

  const userProjects = await db
    .select({ projectId: projectMembers.projectId, orgId: projects.orgId })
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
    db.delete(verification).where(eq(verification.identifier, userToDelete.email)),
    db.delete(user).where(eq(user.id, userId)),
  ]);

  return { success: true, message: 'User deleted successfully' };
}

export async function banAdminUser(
  session: Session,
  db: Database,
  userId: string,
  data: { reason?: string; expiresAt?: string | null },
) {
  assertAdmin(session);

  if (session.user.id === userId) {
    throw Response.json(
      createValidationError(
        'userId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        userId,
        'cannot_ban_self',
      ),
      { status: 400 },
    );
  }

  const reason = data.reason || 'Banned by administrator';
  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

  await db.batch([
    db
      .update(user)
      .set({
        banned: true,
        banReason: reason,
        banExpires: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId)),
    db.delete(sessionTable).where(eq(sessionTable.userId, userId)),
  ]);

  return { success: true, message: 'User banned successfully' };
}

export async function unbanAdminUser(session: Session, db: Database, userId: string) {
  assertAdmin(session);

  await db
    .update(user)
    .set({
      banned: false,
      banReason: null,
      banExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  return { success: true, message: 'User unbanned successfully' };
}

export async function revokeAllAdminSessions(session: Session, db: Database, userId: string) {
  assertAdmin(session);

  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
  return { success: true, message: 'All sessions revoked' };
}

export async function revokeAdminSession(
  session: Session,
  db: Database,
  userId: string,
  sessionId: string,
) {
  assertAdmin(session);

  const [existing] = await db
    .select({ id: sessionTable.id, userId: sessionTable.userId })
    .from(sessionTable)
    .where(eq(sessionTable.id, sessionId))
    .limit(1);

  if (!existing || existing.userId !== userId) {
    throw Response.json(createDomainError(USER_ERRORS.NOT_FOUND, { sessionId }), { status: 404 });
  }

  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
  return { success: true, message: 'Session revoked' };
}

export async function impersonateAdminUser(
  session: Session,
  request: Request,
  userId: string,
): Promise<Response> {
  assertAdmin(session);

  if (session.user.id === userId) {
    throw Response.json(
      createValidationError(
        'userId',
        VALIDATION_ERRORS.INVALID_INPUT.code,
        userId,
        'cannot_impersonate_self',
      ),
      { status: 400 },
    );
  }

  const auth = createAuth(env);
  const url = new URL(request.url);
  const authUrl = new URL('/api/auth/admin/impersonate-user', url.origin);

  const cookie = request.headers.get('cookie');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (origin) headers.set('origin', origin);
  if (referer) headers.set('referer', referer);
  headers.set('content-type', 'application/json');
  headers.set('accept', 'application/json');

  const authRequest = new Request(authUrl.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId }),
  });

  const response = await auth.handler(authRequest);

  if (response.status === 403 && env.ENVIRONMENT !== 'production') {
    try {
      const respBody = await response.clone().text();
      console.log('[Admin] Impersonation forbidden:', respBody);
    } catch {
      // ignore
    }
  }

  return response;
}

export async function stopImpersonation(request: Request): Promise<Response> {
  const auth = createAuth(env);
  const url = new URL(request.url);
  const authUrl = new URL('/api/auth/admin/stop-impersonating', url.origin);

  const cookie = request.headers.get('cookie');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (origin) headers.set('origin', origin);
  if (referer) headers.set('referer', referer);
  headers.set('accept', 'application/json');

  const authRequest = new Request(authUrl.toString(), { method: 'POST', headers });
  return auth.handler(authRequest);
}
