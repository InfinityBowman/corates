/**
 * Admin user details + delete
 *
 * GET /api/admin/users/:userId — user record plus their projects, sessions,
 * linked accounts, and org memberships (each with effective billing plan).
 * DELETE — removes the user and cascades all related rows; member removals
 * are synced to ProjectDoc DOs first to fail fast on DO errors.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import {
  user,
  session,
  projects,
  projectMembers,
  account,
  verification,
  twoFactor,
  mediaFiles,
  member,
  organization,
} from '@corates/db/schema';
import { desc, eq } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  USER_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
  getPlan,
  getGrantPlan,
  type GrantType,
} from '@corates/shared';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import { syncMemberToDO } from '@corates/workers/project-sync';
import { requireAdmin } from '@/server/guards/requireAdmin';

type HandlerArgs = { request: Request; params: { userId: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { userId } = params;
  const db = createDb(env.DB);

  try {
    const [userData] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    if (!userData) {
      return Response.json(createDomainError(USER_ERRORS.NOT_FOUND, { userId }), { status: 404 });
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
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, userId))
      .orderBy(desc(session.createdAt));

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

    return Response.json(
      {
        user: userData,
        projects: userProjects,
        sessions: userSessions,
        accounts: linkedAccounts,
        orgs: orgsWithBilling,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching user details:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_user_details',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handleDelete = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { userId } = params;
  const db = createDb(env.DB);

  try {
    if (guard.context.userId === userId) {
      return Response.json(
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
      return Response.json(createDomainError(USER_ERRORS.NOT_FOUND, { userId }), { status: 404 });
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
      db.delete(session).where(eq(session.userId, userId)),
      db.delete(account).where(eq(account.userId, userId)),
      db.delete(verification).where(eq(verification.identifier, userToDelete.email)),
      db.delete(user).where(eq(user.id, userId)),
    ]);

    return Response.json({ success: true, message: 'User deleted successfully' }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error deleting user:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'delete_user',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/users/$userId')({
  server: { handlers: { GET: handleGet, DELETE: handleDelete } },
});
