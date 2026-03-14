/**
 * useOrgContext - Provides organization context from URL params
 *
 * Reads orgSlug from router params, fetches orgs list, and resolves the current org.
 */

import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/api/auth-client';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';
import { queryKeys } from '@/lib/queryKeys.js';

const LAST_ORG_KEY = 'corates-last-org-slug';

export function getLastOrgSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_ORG_KEY);
}

export function setLastOrgSlug(slug: string | null) {
  if (typeof window === 'undefined') return;
  if (slug) {
    localStorage.setItem(LAST_ORG_KEY, slug);
  } else {
    localStorage.removeItem(LAST_ORG_KEY);
  }
}

async function fetchOrgs() {
  const { data, error } = await authClient.organization.list();
  if (error) throw new Error(error.message || 'Failed to fetch organizations');
  return data || [];
}

/**
 * Hook to manage organization context
 * @param orgSlug - The org slug from URL params (caller provides this from their router)
 */
export function useOrgContext(orgSlug?: string | null) {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);

  const orgsQuery = useQuery({
    queryKey: queryKeys.orgs.list,
    queryFn: fetchOrgs,
    enabled: isLoggedIn && !isAuthLoading,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  const currentOrg = useMemo(() => {
    if (!orgSlug || !orgsQuery.data) return null;
    return orgsQuery.data.find((o: { slug: string }) => o.slug === orgSlug) || null;
  }, [orgSlug, orgsQuery.data]);

  const isLoading = isAuthLoading || orgsQuery.isLoading;

  const hasNoOrgs = useMemo(() => {
    if (isLoading) return false;
    if (!isLoggedIn) return false;
    return !orgsQuery.data || orgsQuery.data.length === 0;
  }, [isLoading, isLoggedIn, orgsQuery.data]);

  const orgNotFound = useMemo(() => {
    if (isLoading || !orgSlug || !orgsQuery.data) return false;
    return !orgsQuery.data.find((o: { slug: string }) => o.slug === orgSlug);
  }, [isLoading, orgSlug, orgsQuery.data]);

  // Save last org to localStorage when it changes
  useEffect(() => {
    if (currentOrg?.slug) {
      setLastOrgSlug(currentOrg.slug);
    }
  }, [currentOrg?.slug]);

  return {
    orgSlug,
    currentOrg,
    orgs: orgsQuery.data ?? [],
    orgId: currentOrg?.id || null,
    orgName: currentOrg?.name || null,
    isLoading,
    isError: orgsQuery.isError,
    error: orgsQuery.error,
    hasNoOrgs,
    orgNotFound,
    refetchOrgs: orgsQuery.refetch,
  };
}
