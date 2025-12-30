/**
 * useOrgContext - Provides organization context from URL params
 *
 * Reads orgSlug from router params, fetches orgs list, and resolves the current org.
 * Provides guard states for routing decisions.
 */

import { createMemo, createEffect } from 'solid-js';
import { useParams } from '@solidjs/router';
import { useQuery } from '@tanstack/solid-query';
import { authClient } from '@api/auth-client.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { queryKeys } from '@lib/queryKeys.js';

// LocalStorage key for remembering last active org
const LAST_ORG_KEY = 'corates-last-org-slug';

/**
 * Get the last used org slug from localStorage
 */
export function getLastOrgSlug() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_ORG_KEY);
}

/**
 * Save the current org slug to localStorage
 */
export function setLastOrgSlug(slug) {
  if (typeof window === 'undefined') return;
  if (slug) {
    localStorage.setItem(LAST_ORG_KEY, slug);
  } else {
    localStorage.removeItem(LAST_ORG_KEY);
  }
}

/**
 * Fetch organizations for the current user
 */
async function fetchOrgs() {
  const { data, error } = await authClient.organization.list();
  if (error) {
    throw new Error(error.message || 'Failed to fetch organizations');
  }
  return data || [];
}

/**
 * Hook to manage organization context from URL params
 *
 * @returns {Object} Organization context and guard states
 */
export function useOrgContext() {
  const params = useParams();
  const { isLoggedIn, authLoading } = useBetterAuth();

  // Fetch orgs list with TanStack Query
  const orgsQuery = useQuery(() => ({
    queryKey: queryKeys.orgs.list,
    queryFn: fetchOrgs,
    enabled: isLoggedIn() && !authLoading(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  }));

  // Extract orgSlug from URL params
  const orgSlug = () => params.orgSlug;

  // Resolve current org from slug
  const currentOrg = createMemo(() => {
    const slug = orgSlug();
    const orgs = orgsQuery.data;
    if (!slug || !orgs) return null;
    return orgs.find(o => o.slug === slug) || null;
  });

  // Guard states for routing decisions
  const isLoading = () => authLoading() || orgsQuery.isLoading;
  const isError = () => orgsQuery.isError;
  const error = () => orgsQuery.error;

  // User is logged in but has no orgs
  const hasNoOrgs = createMemo(() => {
    if (isLoading()) return false;
    if (!isLoggedIn()) return false;
    const orgs = orgsQuery.data;
    return !orgs || orgs.length === 0;
  });

  // Org slug in URL doesn't match any user's orgs
  const orgNotFound = createMemo(() => {
    if (isLoading()) return false;
    const slug = orgSlug();
    if (!slug) return false;
    const orgs = orgsQuery.data;
    if (!orgs) return false;
    return !orgs.find(o => o.slug === slug);
  });

  // Save last org to localStorage when it changes
  // Using createEffect instead of createMemo since we're doing side effects
  createEffect(() => {
    const org = currentOrg();
    if (org?.slug) {
      setLastOrgSlug(org.slug);
    }
  });

  return {
    // Data
    orgSlug,
    currentOrg,
    orgs: () => orgsQuery.data || [],

    // Derived IDs for API calls
    orgId: () => currentOrg()?.id || null,
    orgName: () => currentOrg()?.name || null,

    // Guard states
    isLoading,
    isError,
    error,
    hasNoOrgs,
    orgNotFound,

    // Actions
    refetchOrgs: () => orgsQuery.refetch(),
  };
}

export default useOrgContext;
