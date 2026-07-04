import { captureError } from '@corates/workers/logger';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import type { Database } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { count, eq } from 'drizzle-orm';
import { requireOrgMemberRemoval } from '@corates/workers/policies';
import {
  throwDomainError,
  DomainErrorException,
  isDomainError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import type { OrgId, UserId } from '@corates/shared/ids';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';
import type { Session } from '@/server/middleware/auth';

interface OrgApi {
  listOrganizations: (req: { headers: Headers }) => Promise<Record<string, unknown>>;
  createOrganization: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  getFullOrganization: (req: {
    headers: Headers;
    query: Record<string, string>;
  }) => Promise<Record<string, unknown> | null>;
  updateOrganization: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  deleteOrganization: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  listMembers: (req: {
    headers: Headers;
    query: Record<string, string>;
  }) => Promise<Record<string, unknown>>;
  addMember: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  updateMemberRole: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  removeMember: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  leaveOrganization: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  setActiveOrganization: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
}

function getOrgApi(): OrgApi {
  return createAuth(env).api as unknown as OrgApi;
}

export async function listOrganizations(request: Request): Promise<object> {
  try {
    const orgApi = getOrgApi();
    return await orgApi.listOrganizations({ headers: request.headers });
  } catch (err) {
    const error = err as Error;
    captureError(err, { tags: { component: 'orgs', action: 'list' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_organizations',
      originalError: error.message,
    });
  }
}

export async function createOrganization(
  request: Request,
  data: {
    name: string;
    slug?: string;
    logo?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<object> {
  try {
    const orgApi = getOrgApi();
    return await orgApi.createOrganization({
      headers: request.headers,
      body: {
        name: data.name,
        slug: data.slug,
        logo: data.logo,
        metadata: data.metadata,
      },
    });
  } catch (err) {
    const error = err as Error;
    captureError(err, { tags: { component: 'orgs', action: 'create' } });
    if (error.message?.includes('slug')) {
      throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'slug_taken' });
    }
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_organization',
      originalError: error.message,
    });
  }
}

export async function getOrganization(
  session: Session,
  db: Database,
  request: Request,
  orgId: OrgId,
) {
  const guard = await requireOrgMembership(session, db, orgId);
  if (!guard.ok) throw guard.error;

  try {
    const orgApi = getOrgApi();
    const result = await orgApi.getFullOrganization({
      headers: request.headers,
      query: { organizationId: orgId },
    });

    if (!result) {
      throwDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_not_found',
        orgId,
      });
    }

    const [projectCount] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    return { ...result, projectCount: projectCount?.count || 0 };
  } catch (err) {
    if (err instanceof DomainErrorException) throw err;
    const error = err as Error;
    captureError(err, { tags: { component: 'orgs', action: 'fetch' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_organization',
      originalError: error.message,
    });
  }
}

export async function updateOrganization(
  session: Session,
  db: Database,
  request: Request,
  orgId: OrgId,
  data: {
    name?: string;
    slug?: string;
    logo?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const membership = await requireOrgMembership(session, db, orgId, 'admin');
  if (!membership.ok) throw membership.error;

  const writeAccess = await requireOrgWriteAccess('PUT', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  try {
    const orgApi = getOrgApi();
    const result = await orgApi.updateOrganization({
      headers: request.headers,
      body: {
        organizationId: orgId,
        data: {
          name: data.name,
          slug: data.slug,
          logo: data.logo,
          metadata: data.metadata,
        },
      },
    });

    return { success: true as const, orgId, ...result };
  } catch (err) {
    if (err instanceof DomainErrorException) throw err;
    const error = err as Error;
    captureError(err, { tags: { component: 'orgs', action: 'update' } });
    if (error.message?.includes('slug')) {
      throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'slug_taken' });
    }
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_organization',
      originalError: error.message,
    });
  }
}

export async function deleteOrganization(
  session: Session,
  db: Database,
  request: Request,
  orgId: OrgId,
) {
  const membership = await requireOrgMembership(session, db, orgId, 'owner');
  if (!membership.ok) throw membership.error;

  const writeAccess = await requireOrgWriteAccess('DELETE', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  try {
    const orgApi = getOrgApi();
    await orgApi.deleteOrganization({
      headers: request.headers,
      body: { organizationId: orgId },
    });

    return { success: true as const, deleted: orgId };
  } catch (err) {
    if (err instanceof DomainErrorException) throw err;
    const error = err as Error;
    captureError(err, { tags: { component: 'orgs', action: 'delete' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_organization',
      originalError: error.message,
    });
  }
}

export async function listOrgMembers(
  session: Session,
  db: Database,
  request: Request,
  orgId: OrgId,
): Promise<object> {
  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.error;

  try {
    const orgApi = getOrgApi();
    return await orgApi.listMembers({
      headers: request.headers,
      query: { organizationId: orgId },
    });
  } catch (err) {
    const error = err as Error;
    captureError(err, { tags: { component: 'orgs', action: 'list-members' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_org_members',
      originalError: error.message,
    });
  }
}

export async function addOrgMember(
  session: Session,
  db: Database,
  request: Request,
  orgId: OrgId,
  data: { userId: string; role?: 'member' | 'admin' | 'owner' },
) {
  const membership = await requireOrgMembership(session, db, orgId, 'admin');
  if (!membership.ok) throw membership.error;

  const writeAccess = await requireOrgWriteAccess('POST', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  try {
    const orgApi = getOrgApi();
    const result = await orgApi.addMember({
      headers: request.headers,
      body: {
        organizationId: orgId,
        userId: data.userId,
        role: data.role ?? 'member',
      },
    });

    return { success: true as const, ...result };
  } catch (err) {
    if (err instanceof DomainErrorException) throw err;
    const error = err as Error;
    captureError(err, { tags: { component: 'orgs', action: 'add-member' } });
    if (error.message?.includes('already') || error.message?.includes('member')) {
      throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'already_member' });
    }
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'add_org_member',
      originalError: error.message,
    });
  }
}

export async function updateMemberRole(
  session: Session,
  db: Database,
  request: Request,
  orgId: OrgId,
  memberId: UserId,
  data: { role: 'member' | 'admin' | 'owner' },
) {
  const membership = await requireOrgMembership(session, db, orgId, 'admin');
  if (!membership.ok) throw membership.error;

  const writeAccess = await requireOrgWriteAccess('PUT', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  try {
    const orgApi = getOrgApi();
    await orgApi.updateMemberRole({
      headers: request.headers,
      body: {
        organizationId: orgId,
        memberId,
        role: data.role,
      },
    });

    return { success: true as const, memberId, role: data.role };
  } catch (err) {
    if (err instanceof DomainErrorException) throw err;
    const error = err as Error;
    captureError(err, { tags: { component: 'orgs', action: 'update-member' } });
    if (error.message?.includes('owner') || error.message?.includes('permission')) {
      throwDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'owner_role_change_requires_owner',
      });
    }
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_org_member',
      originalError: error.message,
    });
  }
}

export async function removeMember(
  session: Session,
  db: Database,
  request: Request,
  orgId: OrgId,
  memberId: UserId,
) {
  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.error;

  const writeAccess = await requireOrgWriteAccess('DELETE', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  const isSelf = memberId === membership.context.userId;

  try {
    await requireOrgMemberRemoval(db, membership.context.userId, orgId, memberId);
  } catch (err) {
    if (isDomainError(err)) {
      throw new DomainErrorException(err);
    }
    throw err;
  }

  try {
    const orgApi = getOrgApi();
    if (isSelf) {
      await orgApi.leaveOrganization({
        headers: request.headers,
        body: { organizationId: orgId },
      });
    } else {
      await orgApi.removeMember({
        headers: request.headers,
        body: {
          organizationId: orgId,
          memberIdOrEmail: memberId,
        },
      });
    }

    return { success: true as const, removed: memberId, isSelf };
  } catch (err) {
    if (err instanceof DomainErrorException) throw err;
    const error = err as Error;
    captureError(err, { tags: { component: 'orgs', action: 'remove-member' } });
    if (error.message?.includes('owner') || error.message?.includes('last')) {
      throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'cannot_remove_last_owner' });
    }
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'remove_org_member',
      originalError: error.message,
    });
  }
}

export async function setActiveOrg(session: Session, db: Database, request: Request, orgId: OrgId) {
  const guard = await requireOrgMembership(session, db, orgId);
  if (!guard.ok) throw guard.error;

  try {
    const orgApi = getOrgApi();
    await orgApi.setActiveOrganization({
      headers: request.headers,
      body: { organizationId: orgId },
    });

    return { success: true as const, activeOrganizationId: orgId };
  } catch (err) {
    const error = err as Error;
    captureError(err, { tags: { component: 'orgs', action: 'set-active' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'set_active_organization',
      originalError: error.message,
    });
  }
}
