/**
 * Admin queries using TanStack Query
 * Provides hooks for admin dashboard data fetching
 */

import { useQuery } from '@tanstack/solid-query';
import { API_BASE } from '@config/api.js';
import { queryKeys } from '@lib/queryKeys.js';
import { fetchOrgs, fetchOrgDetails, fetchOrgBilling } from '@/stores/adminStore.js';

/**
 * Helper for admin fetch calls
 * Uses cache: 'no-store' to prevent browser HTTP caching from serving stale data
 */
async function adminFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}/api/admin/${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch ${path}`);
  }
  return response.json();
}

/**
 * Hook to fetch admin dashboard stats
 */
export function useAdminStats() {
  return useQuery(() => ({
    queryKey: queryKeys.admin.stats,
    queryFn: () => adminFetch('stats'),
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: 'always', // Always refetch on mount, even if data exists
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
      staleTime: 0, // Always consider data stale to force refetch
      gcTime: 1000 * 60 * 5, // 5 minutes
      refetchOnMount: 'always', // Always refetch on mount, even if data exists
    };
  });
}

/**
 * Hook to fetch single user details
 */
export function useAdminUserDetails(userId) {
  return useQuery(() => ({
    queryKey: queryKeys.admin.userDetails(userId),
    queryFn: () => adminFetch(`users/${userId}`),
    enabled: !!userId,
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: 'always', // Always refetch on mount, even if data exists
  }));
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
      staleTime: 0, // Always consider data stale to force refetch
      gcTime: 1000 * 60 * 5, // 5 minutes
      refetchOnMount: 'always', // Always refetch on mount, even if data exists
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
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: 'always', // Always refetch on mount, even if data exists
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
      staleTime: 0,
      gcTime: 1000 * 60 * 5,
      refetchOnMount: 'always',
    };
  });
}

/**
 * Hook to fetch single org details
 */
export function useAdminOrgDetails(orgId) {
  return useQuery(() => ({
    queryKey: queryKeys.admin.orgDetails(orgId),
    queryFn: () => fetchOrgDetails(orgId),
    enabled: !!orgId,
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: 'always',
  }));
}

/**
 * Hook to fetch org billing details
 */
export function useAdminOrgBilling(orgId) {
  return useQuery(() => ({
    queryKey: queryKeys.admin.orgBilling(orgId),
    queryFn: () => fetchOrgBilling(orgId),
    enabled: !!orgId,
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: 'always',
  }));
}
