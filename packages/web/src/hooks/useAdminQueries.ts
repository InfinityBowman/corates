/**
 * Admin queries using TanStack React Query
 * Provides hooks for admin dashboard data fetching
 */

import { useQuery } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { api } from '@/lib/rpc';
import { queryKeys } from '@/lib/queryKeys';
import {
  fetchOrgs,
  fetchOrgDetails,
  fetchOrgBilling,
  fetchBillingLedger,
  fetchBillingStuckStates,
  fetchOrgBillingReconcile,
} from '@/stores/adminStore';

const ADMIN_QUERY_CONFIG = {
  staleTime: 0,
  gcTime: 1000 * 60 * 5,
  refetchOnMount: 'always' as const,
};

export function useAdminStats() {
  // TODO(agent): GET /api/admin/stats was never implemented backend-side; the
  // statsRoutes mount only handles /signups, /organizations, /projects,
  // /webhooks, /subscriptions, /revenue. This hook has been returning a 404
  // for as long as it's existed. Either delete it or wire it to a real
  // aggregate endpoint.
  return useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: async () => {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminUsers(params: { page?: number; limit?: number; search?: string } = {}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const search = params.search ?? '';
  return useQuery({
    queryKey: queryKeys.admin.users(page, limit, search),
    queryFn: () => {
      const query: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
      };
      if (search) query.search = search;
      return parseResponse(api.api.admin.users.$get({ query }));
    },
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminUserDetails(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.userDetails(userId),
    queryFn: () =>
      parseResponse(api.api.admin.users[':userId'].$get({ param: { userId: userId! } })),
    enabled: !!userId,
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminProjects(
  params: { page?: number; limit?: number; search?: string; orgId?: string } = {},
) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const search = params.search ?? '';
  const orgId = params.orgId ?? '';
  return useQuery({
    queryKey: queryKeys.admin.projects(page, limit, search, orgId),
    queryFn: async () => {
      const qs = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (search) qs.set('search', search);
      if (orgId) qs.set('orgId', orgId);
      const res = await fetch(`/api/admin/projects?${qs.toString()}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw data;
      return data;
    },
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminProjectDetails(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.projectDetails(projectId),
    queryFn: async () => {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(projectId!)}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw data;
      return data;
    },
    enabled: !!projectId,
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminProjectDocStats(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.projectDocStats(projectId),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/projects/${encodeURIComponent(projectId!)}/doc-stats`,
        { credentials: 'include' },
      );
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw data;
      return data;
    },
    enabled: !!projectId,
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useStorageDocuments(
  params: { cursor?: string | null; limit?: number; prefix?: string; search?: string } = {},
) {
  const cursor = params.cursor ?? null;
  const limit = params.limit ?? 50;
  const prefix = params.prefix ?? '';
  const search = params.search ?? '';
  return useQuery({
    queryKey: queryKeys.admin.storageDocuments(cursor, limit, prefix, search),
    queryFn: async () => {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (cursor) params.set('cursor', cursor);
      if (prefix) params.set('prefix', prefix);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/storage/documents?${params.toString()}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw data;
      return data;
    },
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminOrgs(params: { page?: number; limit?: number; search?: string } = {}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const search = params.search ?? '';
  return useQuery({
    queryKey: queryKeys.admin.orgs(page, limit, search),
    queryFn: () => fetchOrgs({ page, limit, search }),
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminOrgDetails(orgId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.orgDetails(orgId),
    queryFn: () => fetchOrgDetails(orgId!),
    enabled: !!orgId,
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminOrgBilling(orgId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.orgBilling(orgId),
    queryFn: () => fetchOrgBilling(orgId!),
    enabled: !!orgId,
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminBillingLedger(
  params: { limit?: number; status?: string; type?: string } = {},
) {
  const queryParams = {
    limit: params.limit ?? 50,
    status: params.status,
    type: params.type,
  };
  return useQuery({
    queryKey: queryKeys.admin.billingLedger(queryParams),
    queryFn: () => fetchBillingLedger(queryParams),
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminBillingStuckStates(
  params: { incompleteThreshold?: number; limit?: number } = {},
) {
  const queryParams = {
    incompleteThreshold: params.incompleteThreshold ?? 30,
    limit: params.limit ?? 50,
  };
  return useQuery({
    queryKey: queryKeys.admin.billingStuckStates(queryParams),
    queryFn: () => fetchBillingStuckStates(queryParams),
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminOrgBillingReconcile(
  orgId: string | null | undefined,
  params: {
    checkStripe?: boolean;
    incompleteThreshold?: number;
    checkoutNoSubThreshold?: number;
    processingLagThreshold?: number;
  } = {},
) {
  const queryParams = {
    checkStripe: params.checkStripe ?? false,
    incompleteThreshold: params.incompleteThreshold ?? 30,
    checkoutNoSubThreshold: params.checkoutNoSubThreshold ?? 15,
    processingLagThreshold: params.processingLagThreshold ?? 5,
  };
  return useQuery({
    queryKey: queryKeys.admin.orgBillingReconcile(orgId, queryParams),
    queryFn: () => fetchOrgBillingReconcile(orgId!, queryParams),
    enabled: !!orgId,
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminDatabaseTables() {
  return useQuery({
    queryKey: queryKeys.admin.databaseTables,
    queryFn: async () => {
      const res = await fetch('/api/admin/database/tables', { credentials: 'include' });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw data;
      return data;
    },
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminTableSchema(tableName: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.tableSchema(tableName),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/database/tables/${encodeURIComponent(tableName!)}/schema`,
        { credentials: 'include' },
      );
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw data;
      return data;
    },
    enabled: !!tableName,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

export function useAdminTableRows(
  params: {
    tableName?: string;
    page?: number;
    limit?: number;
    orderBy?: string;
    order?: string;
    filterBy?: string | null;
    filterValue?: string | null;
  } = {},
) {
  const tableName = params.tableName;
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const orderBy = params.orderBy ?? 'id';
  const order = params.order ?? 'desc';
  const filterBy = params.filterBy ?? null;
  const filterValue = params.filterValue ?? null;

  return useQuery({
    queryKey: queryKeys.admin.tableRows(
      tableName,
      page,
      limit,
      orderBy,
      order,
      filterBy,
      filterValue,
    ),
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        orderBy,
        order,
      });
      if (filterBy && filterValue) {
        qs.set('filterBy', filterBy);
        qs.set('filterValue', filterValue);
      }
      const res = await fetch(
        `/api/admin/database/tables/${encodeURIComponent(tableName!)}/rows?${qs.toString()}`,
        { credentials: 'include' },
      );
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw data;
      return data;
    },
    enabled: !!tableName,
    ...ADMIN_QUERY_CONFIG,
  });
}
