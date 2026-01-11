/**
 * Admin queries using TanStack Query
 * Provides hooks for admin dashboard data fetching
 */

import { useQuery } from '@tanstack/solid-query';
import { queryKeys } from '@lib/queryKeys.js';
import { apiFetch } from '@lib/apiFetch.js';
import {
  fetchOrgs,
  fetchOrgDetails,
  fetchOrgBilling,
  fetchBillingLedger,
  fetchBillingStuckStates,
  fetchOrgBillingReconcile,
} from '@/stores/adminStore.js';

/**
 * Helper for admin fetch calls
 * Uses apiFetch for proper error handling and normalization
 */
async function adminFetch(path) {
  return apiFetch(`/api/admin/${path}`, {
    showToast: false, // Admin panel handles its own error display via TanStack Query
  });
}

/**
 * Default cache config for admin queries
 * Admin data should always be fresh - no stale data shown
 */
const ADMIN_QUERY_CONFIG = {
  staleTime: 0,
  gcTime: 1000 * 60 * 5,
  refetchOnMount: 'always',
};

/**
 * Hook to fetch admin dashboard stats
 */
export function useAdminStats() {
  return useQuery(() => ({
    queryKey: queryKeys.admin.stats,
    queryFn: () => adminFetch('stats'),
    ...ADMIN_QUERY_CONFIG,
  }));
}

/**
 * Hook to fetch users with pagination and search
 * @param {() => {page: number, limit: number, search: string}} getParams - Function returning params
 */
export function useAdminUsers(getParams) {
  return useQuery(() => {
    const params = typeof getParams === 'function' ? getParams() : getParams;
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const search = params?.search ?? '';
    return {
      queryKey: queryKeys.admin.users(page, limit, search),
      queryFn: () => {
        const searchParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (search) searchParams.set('search', search);
        return adminFetch(`users?${searchParams.toString()}`);
      },
      ...ADMIN_QUERY_CONFIG,
    };
  });
}

/**
 * Hook to fetch single user details
 */
export function useAdminUserDetails(getUserId) {
  return useQuery(() => {
    const userId = typeof getUserId === 'function' ? getUserId() : getUserId;
    return {
      queryKey: queryKeys.admin.userDetails(userId),
      queryFn: () => adminFetch(`users/${userId}`),
      enabled: !!userId,
      ...ADMIN_QUERY_CONFIG,
    };
  });
}

/**
 * Hook to fetch projects with pagination and search
 * @param {() => {page: number, limit: number, search: string, orgId: string}} getParams - Function returning params
 */
export function useAdminProjects(getParams) {
  return useQuery(() => {
    const params = typeof getParams === 'function' ? getParams() : getParams;
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const search = params?.search ?? '';
    const orgId = params?.orgId ?? '';
    return {
      queryKey: queryKeys.admin.projects(page, limit, search, orgId),
      queryFn: () => {
        const searchParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (search) searchParams.set('search', search);
        if (orgId) searchParams.set('orgId', orgId);
        return adminFetch(`projects?${searchParams.toString()}`);
      },
      ...ADMIN_QUERY_CONFIG,
    };
  });
}

/**
 * Hook to fetch single project details
 */
export function useAdminProjectDetails(getProjectId) {
  return useQuery(() => {
    const projectId = typeof getProjectId === 'function' ? getProjectId() : getProjectId;
    return {
      queryKey: queryKeys.admin.projectDetails(projectId),
      queryFn: () => adminFetch(`projects/${projectId}`),
      enabled: !!projectId,
      ...ADMIN_QUERY_CONFIG,
    };
  });
}

/**
 * Hook to fetch storage documents with cursor-based pagination
 * @param {() => {cursor: string|null, limit: number, prefix: string, search: string}} getParams - Function returning params
 */
export function useStorageDocuments(getParams) {
  return useQuery(() => {
    const params = typeof getParams === 'function' ? getParams() : getParams;
    const cursor = params?.cursor ?? null;
    const limit = params?.limit ?? 50;
    const prefix = params?.prefix ?? '';
    const search = params?.search ?? '';
    return {
      queryKey: queryKeys.admin.storageDocuments(cursor, limit, prefix, search),
      queryFn: () => {
        const searchParams = new URLSearchParams({
          limit: limit.toString(),
        });
        if (cursor) searchParams.set('cursor', cursor);
        if (prefix) searchParams.set('prefix', prefix);
        if (search) searchParams.set('search', search);
        return adminFetch(`storage/documents?${searchParams.toString()}`);
      },
      ...ADMIN_QUERY_CONFIG,
    };
  });
}

/**
 * Hook to fetch storage statistics
 */
export function useStorageStats() {
  return useQuery(() => ({
    queryKey: queryKeys.admin.storageStats,
    queryFn: () => adminFetch('storage/stats'),
    ...ADMIN_QUERY_CONFIG,
  }));
}

/**
 * Hook to fetch orgs with pagination and search
 * @param {() => {page: number, limit: number, search: string}} getParams - Function returning params
 */
export function useAdminOrgs(getParams) {
  return useQuery(() => {
    const params = typeof getParams === 'function' ? getParams() : getParams;
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const search = params?.search ?? '';
    return {
      queryKey: queryKeys.admin.orgs(page, limit, search),
      queryFn: () => fetchOrgs({ page, limit, search }),
      ...ADMIN_QUERY_CONFIG,
    };
  });
}

/**
 * Hook to fetch single org details
 */
export function useAdminOrgDetails(getOrgId) {
  return useQuery(() => {
    const orgId = typeof getOrgId === 'function' ? getOrgId() : getOrgId;
    return {
      queryKey: queryKeys.admin.orgDetails(orgId),
      queryFn: () => fetchOrgDetails(orgId),
      enabled: !!orgId,
      ...ADMIN_QUERY_CONFIG,
    };
  });
}

/**
 * Hook to fetch org billing details
 */
export function useAdminOrgBilling(getOrgId) {
  return useQuery(() => {
    const orgId = typeof getOrgId === 'function' ? getOrgId() : getOrgId;
    return {
      queryKey: queryKeys.admin.orgBilling(orgId),
      queryFn: () => fetchOrgBilling(orgId),
      enabled: !!orgId,
      ...ADMIN_QUERY_CONFIG,
    };
  });
}

/**
 * Hook to fetch Stripe event ledger entries
 */
export function useAdminBillingLedger(getParams) {
  return useQuery(() => {
    const params = typeof getParams === 'function' ? getParams() : getParams || {};
    const queryParams = {
      limit: params.limit ?? 50,
      status: params.status ?? undefined,
      type: params.type ?? undefined,
    };
    return {
      queryKey: queryKeys.admin.billingLedger(queryParams),
      queryFn: () => fetchBillingLedger(queryParams),
      ...ADMIN_QUERY_CONFIG,
    };
  });
}

/**
 * Hook to fetch orgs with stuck billing states
 */
export function useAdminBillingStuckStates(getParams) {
  return useQuery(() => {
    const params = typeof getParams === 'function' ? getParams() : getParams || {};
    const queryParams = {
      incompleteThreshold: params.incompleteThreshold ?? 30,
      limit: params.limit ?? 50,
    };
    return {
      queryKey: queryKeys.admin.billingStuckStates(queryParams),
      queryFn: () => fetchBillingStuckStates(queryParams),
      ...ADMIN_QUERY_CONFIG,
    };
  });
}

/**
 * Hook to fetch org billing reconciliation results
 */
export function useAdminOrgBillingReconcile(orgId, getParams) {
  return useQuery(() => {
    const params = typeof getParams === 'function' ? getParams() : getParams || {};
    const queryParams = {
      checkStripe: params.checkStripe ?? false,
      incompleteThreshold: params.incompleteThreshold ?? 30,
      checkoutNoSubThreshold: params.checkoutNoSubThreshold ?? 15,
      processingLagThreshold: params.processingLagThreshold ?? 5,
    };
    return {
      queryKey: queryKeys.admin.orgBillingReconcile(orgId, queryParams),
      queryFn: () => fetchOrgBillingReconcile(orgId, queryParams),
      enabled: !!orgId,
      ...ADMIN_QUERY_CONFIG,
    };
  });
}

/**
 * Hook to fetch D1 database tables with row counts
 */
export function useAdminDatabaseTables() {
  return useQuery(() => ({
    queryKey: queryKeys.admin.databaseTables,
    queryFn: () => adminFetch('database/tables'),
    ...ADMIN_QUERY_CONFIG,
  }));
}

/**
 * Hook to fetch table schema
 */
export function useAdminTableSchema(tableName) {
  return useQuery(() => ({
    queryKey: queryKeys.admin.tableSchema(tableName()),
    queryFn: () => adminFetch(`database/tables/${tableName()}/schema`),
    enabled: !!tableName(),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  }));
}

/**
 * Hook to fetch table rows with pagination and filtering
 */
export function useAdminTableRows(getParams) {
  return useQuery(() => {
    const params = typeof getParams === 'function' ? getParams() : getParams;
    const tableName = params?.tableName;
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const orderBy = params?.orderBy ?? 'id';
    const order = params?.order ?? 'desc';
    const filterBy = params?.filterBy ?? null;
    const filterValue = params?.filterValue ?? null;

    return {
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
        const searchParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          orderBy,
          order,
        });
        if (filterBy && filterValue) {
          searchParams.set('filterBy', filterBy);
          searchParams.set('filterValue', filterValue);
        }
        return adminFetch(`database/tables/${tableName}/rows?${searchParams}`);
      },
      enabled: !!tableName,
      ...ADMIN_QUERY_CONFIG,
    };
  });
}
