import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import type { Database } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { count, eq } from 'drizzle-orm';
import { requireOrgMemberRemoval } from '@corates/workers/policies';
import {
  createDomainError,
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
    console.error('Error listing organizations:', error);
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'list_organizations',
        originalError: error.message,
      }),
      { status: 500 },
    );
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
    console.error('Error creating organization:', error);
    if (error.message?.includes('slug')) {
      throw Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'slug_taken' }),
        { status: 403 },
      );
    }
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'create_organization',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
}

export async function getOrganization(
  session: Session,
  db: Database,
  request: Request,
  orgId: OrgId,
) {
  const guard = await requireOrgMembership(session, db, orgId);
  if (!guard.ok) throw guard.response;

  try {
    const orgApi = getOrgApi();
    const result = await orgApi.getFullOrganization({
      headers: request.headers,
      query: { organizationId: orgId },
    });

    if (!result) {
      throw Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, {
          reason: 'org_not_found',
          orgId,
        }),
        { status: 403 },
      );
    }

    const [projectCount] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    return { ...result, projectCount: projectCount?.count || 0 };
  } catch (err) {
    if (err instanceof Response) throw err;
    const error = err as Error;
    console.error('Error fetching organization:', error);
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_organization',
        originalError: error.message,
      }),
      { status: 500 },
    );
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
  if (!membership.ok) throw membership.response;

  const writeAccess = await requireOrgWriteAccess('PUT', db, orgId);
  if (!writeAccess.ok) throw writeAccess.response;

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
    if (err instanceof Response) throw err;
    const error = err as Error;
    console.error('Error updating organization:', error);
    if (error.message?.includes('slug')) {
      throw Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'slug_taken' }),
        { status: 403 },
      );
    }
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_organization',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
}

export async function deleteOrganization(
  session: Session,
  db: Database,
  request: Request,
  orgId: OrgId,
) {
  const membership = await requireOrgMembership(session, db, orgId, 'owner');
  if (!membership.ok) throw membership.response;

  const writeAccess = await requireOrgWriteAccess('DELETE', db, orgId);
  if (!writeAccess.ok) throw writeAccess.response;

  try {
    const orgApi = getOrgApi();
    await orgApi.deleteOrganization({
      headers: request.headers,
      body: { organizationId: orgId },
    });

    return { success: true as const, deleted: orgId };
  } catch (err) {
    if (err instanceof Response) throw err;
    const error = err as Error;
    console.error('Error deleting organization:', error);
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'delete_organization',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
}

export async function listOrgMembers(
  session: Session,
  db: Database,
  request: Request,
  orgId: OrgId,
): Promise<object> {
  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.response;

  try {
    const orgApi = getOrgApi();
    return await orgApi.listMembers({
      headers: request.headers,
      query: { organizationId: orgId },
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error listing org members:', error);
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'list_org_members',
        originalError: error.message,
      }),
      { status: 500 },
    );
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
  if (!membership.ok) throw membership.response;

  const writeAccess = await requireOrgWriteAccess('POST', db, orgId);
  if (!writeAccess.ok) throw writeAccess.response;

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
    if (err instanceof Response) throw err;
    const error = err as Error;
    console.error('Error adding org member:', error);
    if (error.message?.includes('already') || error.message?.includes('member')) {
      throw Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'already_member' }),
        { status: 403 },
      );
    }
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'add_org_member',
        originalError: error.message,
      }),
      { status: 500 },
    );
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
  if (!membership.ok) throw membership.response;

  const writeAccess = await requireOrgWriteAccess('PUT', db, orgId);
  if (!writeAccess.ok) throw writeAccess.response;

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
    if (err instanceof Response) throw err;
    const error = err as Error;
    console.error('Error updating org member:', error);
    if (error.message?.includes('owner') || error.message?.includes('permission')) {
      throw Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, {
          reason: 'owner_role_change_requires_owner',
        }),
        { status: 403 },
      );
    }
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_org_member',
        originalError: error.message,
      }),
      { status: 500 },
    );
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
  if (!membership.ok) throw membership.response;

  const writeAccess = await requireOrgWriteAccess('DELETE', db, orgId);
  if (!writeAccess.ok) throw writeAccess.response;

  const isSelf = memberId === membership.context.userId;

  try {
    await requireOrgMemberRemoval(db, membership.context.userId, orgId, memberId);
  } catch (err) {
    if (isDomainError(err)) {
      throw Response.json(err, { status: 403 });
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
    if (err instanceof Response) throw err;
    const error = err as Error;
    console.error('Error removing org member:', error);
    if (error.message?.includes('owner') || error.message?.includes('last')) {
      throw Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'cannot_remove_last_owner' }),
        { status: 403 },
      );
    }
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'remove_org_member',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
}

export async function setActiveOrg(
  session: Session,
  db: Database,
  request: Request,
  orgId: OrgId,
) {
  const guard = await requireOrgMembership(session, db, orgId);
  if (!guard.ok) throw guard.response;

  try {
    const orgApi = getOrgApi();
    await orgApi.setActiveOrganization({
      headers: request.headers,
      body: { organizationId: orgId },
    });

    return { success: true as const, activeOrganizationId: orgId };
  } catch (err) {
    const error = err as Error;
    console.error('Error setting active organization:', error);
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'set_active_organization',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
}
