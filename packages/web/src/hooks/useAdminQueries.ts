/**
 * Admin queries using TanStack React Query
 * Provides hooks for admin dashboard data fetching
 */

import { useQuery, queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { fetchOrgBillingReconcile } from '@/stores/adminStore';
import {
  getAdminUsersAction,
  getAdminUserDetailsAction,
} from '@/server/functions/admin-users.functions';
import {
  getAdminOrgsAction,
  getAdminOrgDetailsAction,
  getAdminOrgBillingAction,
} from '@/server/functions/admin-orgs.functions';
import {
  getAdminProjectsAction,
  getAdminProjectDetailsAction,
  getAdminProjectDocStatsAction,
} from '@/server/functions/admin-projects.functions';
import { getAdminStatsAction } from '@/server/functions/admin-stats.functions';
import {
  getAdminBillingLedgerAction,
  getAdminBillingStuckStatesAction,
} from '@/server/functions/admin-billing.functions';
import {
  listAdminStorageDocumentsAction,
} from '@/server/functions/admin-storage.functions';
import {
  listAdminDatabaseTablesAction,
  getAdminTableSchemaAction,
  getAdminTableRowsAction,
} from '@/server/functions/admin-database.functions';

const ADMIN_QUERY_CONFIG = {
  staleTime: 0,
  gcTime: 1000 * 60 * 5,
  refetchOnMount: 'always' as const,
};

export function useAdminStats() {
  return useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: () => getAdminStatsAction(),
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminUsers(params: { page?: number; limit?: number; search?: string } = {}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const search = params.search ?? '';
  return useQuery({
    queryKey: queryKeys.admin.users(page, limit, search),
    queryFn: () =>
      getAdminUsersAction({
        data: { page, limit, ...(search ? { search } : {}) },
      }),
    ...ADMIN_QUERY_CONFIG,
  });
}

export function adminUserDetailsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.admin.userDetails(userId),
    queryFn: () => getAdminUserDetailsAction({ data: { userId } }),
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
    queryFn: () =>
      getAdminProjectsAction({
        data: { page, limit, ...(search ? { search } : {}), ...(orgId ? { orgId } : {}) },
      }),
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminProjectDetails(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.projectDetails(projectId),
    queryFn: () => getAdminProjectDetailsAction({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminProjectDocStats(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.projectDocStats(projectId),
    queryFn: () => getAdminProjectDocStatsAction({ data: { projectId: projectId! } }),
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
    queryFn: () =>
      listAdminStorageDocumentsAction({
        data: {
          ...(cursor ? { cursor } : {}),
          limit,
          ...(prefix ? { prefix } : {}),
          ...(search ? { search } : {}),
        },
      }),
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminOrgs(params: { page?: number; limit?: number; search?: string } = {}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const search = params.search ?? '';
  return useQuery({
    queryKey: queryKeys.admin.orgs(page, limit, search),
    queryFn: () => getAdminOrgsAction({ data: { page, limit, ...(search ? { search } : {}) } }),
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminOrgDetails(orgId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.orgDetails(orgId),
    queryFn: () => getAdminOrgDetailsAction({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminOrgBilling(orgId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.orgBilling(orgId),
    queryFn: () => getAdminOrgBillingAction({ data: { orgId: orgId! } }),
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
    queryFn: () => getAdminBillingLedgerAction({ data: queryParams }),
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
    queryFn: () => getAdminBillingStuckStatesAction({ data: queryParams }),
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
    queryFn: () => listAdminDatabaseTablesAction(),
    ...ADMIN_QUERY_CONFIG,
  });
}

export function useAdminTableSchema(tableName: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.tableSchema(tableName),
    queryFn: () => getAdminTableSchemaAction({ data: { tableName: tableName! } }),
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
    queryFn: () =>
      getAdminTableRowsAction({
        data: {
          tableName: tableName!,
          page,
          limit,
          orderBy,
          order,
          ...(filterBy && filterValue ? { filterBy, filterValue } : {}),
        },
      }),
    enabled: !!tableName,
    ...ADMIN_QUERY_CONFIG,
  });
}
