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
  return useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: () => parseResponse(api.api.admin.stats.$get()),
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
    queryFn: () => {
      const query: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
      };
      if (search) query.search = search;
      if (orgId) query.orgId = orgId;
      return parseResponse(api.api.admin.projects.$get({ query }));
    },
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminProjectDetails(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.projectDetails(projectId),
    queryFn: () =>
      parseResponse(
        api.api.admin.projects[':projectId'].$get({ param: { projectId: projectId! } }),
      ),
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
    queryFn: () => {
      const query: Record<string, string> = { limit: limit.toString() };
      if (cursor) query.cursor = cursor;
      if (prefix) query.prefix = prefix;
      if (search) query.search = search;
      return parseResponse(api.api.admin.storage.documents.$get({ query }));
    },
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useStorageStats() {
  return useQuery({
    queryKey: queryKeys.admin.storageStats,
    queryFn: () => parseResponse(api.api.admin.storage.stats.$get()),
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
    queryFn: () => parseResponse(api.api.admin.database.tables.$get()),
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminTableSchema(tableName: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.tableSchema(tableName),
    queryFn: () =>
      parseResponse(
        api.api.admin.database.tables[':tableName'].schema.$get({
          param: { tableName: tableName! },
        }),
      ),
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
    queryFn: () => {
      const query: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
        orderBy,
        order,
      };
      if (filterBy && filterValue) {
        query.filterBy = filterBy;
        query.filterValue = filterValue;
      }
      return parseResponse(
        api.api.admin.database.tables[':tableName'].rows.$get({
          param: { tableName: tableName! },
          query,
        }),
      );
    },
    enabled: !!tableName,
    ...ADMIN_QUERY_CONFIG,
  });
}
