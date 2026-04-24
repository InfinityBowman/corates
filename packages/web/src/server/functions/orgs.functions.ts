import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { OrgId, UserId } from '@corates/shared/ids';
import { authMiddleware } from '@/server/middleware/auth';
import {
  listOrganizations,
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  listOrgMembers,
  addOrgMember as addOrgMemberImpl,
  updateMemberRole,
  removeMember,
  setActiveOrg,
} from './orgs.server';

export const getOrganizations = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { request } }) => listOrganizations(request));

export const createOrg = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1),
      slug: z.string().optional(),
      logo: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ data, context: { request } }) => createOrganization(request, data));

export const getOrg = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string() }))
  .handler(async ({ data, context: { session, db, request } }) =>
    getOrganization(session, db, request, data.orgId as OrgId),
  );

export const updateOrg = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      name: z.string().optional(),
      slug: z.string().optional(),
      logo: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ data, context: { session, db, request } }) => {
    const { orgId, ...updateData } = data;
    return updateOrganization(session, db, request, orgId as OrgId, updateData);
  });

export const deleteOrg = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string() }))
  .handler(async ({ data, context: { session, db, request } }) =>
    deleteOrganization(session, db, request, data.orgId as OrgId),
  );

export const getOrgMembers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string() }))
  .handler(async ({ data, context: { session, db, request } }) =>
    listOrgMembers(session, db, request, data.orgId as OrgId),
  );

export const addOrgMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      userId: z.string().min(1),
      role: z.enum(['member', 'admin', 'owner']).optional(),
    }),
  )
  .handler(async ({ data, context: { session, db, request } }) => {
    const { orgId, ...memberData } = data;
    return addOrgMemberImpl(session, db, request, orgId as OrgId, memberData);
  });

export const updateOrgMemberRole = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      memberId: z.string(),
      role: z.enum(['member', 'admin', 'owner']),
    }),
  )
  .handler(async ({ data, context: { session, db, request } }) =>
    updateMemberRole(session, db, request, data.orgId as OrgId, data.memberId as UserId, {
      role: data.role,
    }),
  );

export const removeOrgMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      memberId: z.string(),
    }),
  )
  .handler(async ({ data, context: { session, db, request } }) =>
    removeMember(session, db, request, data.orgId as OrgId, data.memberId as UserId),
  );

export const setActiveOrganization = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string() }))
  .handler(async ({ data, context: { session, db, request } }) =>
    setActiveOrg(session, db, request, data.orgId as OrgId),
  );
