/**
 * Admin store for managing admin state and API calls (Zustand)
 *
 * The API functions are plain async functions that use Hono RPC directly.
 * Only the 4 reactive state values are in the Zustand store.
 * checkAdminStatus, checkImpersonationStatus, and stopImpersonation use apiFetch
 * because their endpoints are not on the typed app router.
 */

import { create } from 'zustand';
import { apiFetch } from '@/lib/apiFetch';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

interface SessionResponse {
  user?: { role?: string; [key: string]: unknown };
  session?: { impersonatedBy?: string; [key: string]: unknown };
}

interface AdminState {
  isAdminChecked: boolean;
  isAdmin: boolean;
  isImpersonating: boolean;
  impersonatedBy: string | null;
}

interface AdminActions {
  checkAdminStatus: () => Promise<boolean>;
  checkImpersonationStatus: () => Promise<void>;
  impersonateUser: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

export const useAdminStore = create<AdminState & AdminActions>()(set => ({
  isAdminChecked: false,
  isAdmin: false,
  isImpersonating: false,
  impersonatedBy: null,

  checkAdminStatus: async () => {
    try {
      const data = await apiFetch.get<SessionResponse>('/api/auth/get-session', {
        toastMessage: false,
      });
      const admin = data?.user?.role === 'admin';
      set({ isAdmin: admin });
      return admin;
    } catch (err) {
      console.warn('Failed to check admin status:', (err as Error).message);
      set({ isAdmin: false });
      return false;
    } finally {
      set({ isAdminChecked: true });
    }
  },

  checkImpersonationStatus: async () => {
    try {
      const data = await apiFetch.get<SessionResponse>('/api/auth/get-session', {
        toastMessage: false,
      });
      if (data?.session?.impersonatedBy) {
        set({ isImpersonating: true, impersonatedBy: data.session.impersonatedBy });
        return;
      }
      set({ isImpersonating: false, impersonatedBy: null });
    } catch (err) {
      set({ isImpersonating: false, impersonatedBy: null });
      console.error('[Admin] Error checking impersonation status:', err);
    }
  },

  impersonateUser: async userId => {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/impersonate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      throw data;
    }
    set({ isImpersonating: true });
    window.location.href = '/';
  },

  stopImpersonation: async () => {
    await apiFetch.post('/api/admin/stop-impersonation', null, { toastMessage: false });
    set({ isImpersonating: false });
    window.location.href = '/admin';
  },
}));

// Admin API functions (plain async, no store state needed)

export async function banUser(userId: string, reason: string, expiresAt: string | null = null) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/ban`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, expiresAt }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function unbanUser(userId: string) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/unban`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function revokeUserSessions(userId: string) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/sessions`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function revokeUserSession(userId: string, sessionId: string) {
  const res = await fetch(
    `/api/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
    { method: 'DELETE', credentials: 'include' },
  );
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function deleteUser(userId: string) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function deleteStorageDocuments(keys: string[]) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('Keys array is required');
  }
  const res = await fetch('/api/admin/storage/documents', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function fetchOrgs({ page = 1, limit = 20, search = '' } = {}) {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (search) params.set('search', search);
  const res = await fetch(`/api/admin/orgs?${params.toString()}`, { credentials: 'include' });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function fetchOrgDetails(orgId: string) {
  const res = await fetch(`/api/admin/orgs/${encodeURIComponent(orgId)}`, {
    credentials: 'include',
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function fetchOrgBilling(orgId: string) {
  const res = await fetch(`/api/admin/orgs/${encodeURIComponent(orgId)}/billing`, {
    credentials: 'include',
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

async function adminBillingMutate(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  orgId: string,
  body?: Record<string, unknown>,
) {
  const init: RequestInit = { method, credentials: 'include' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return data;
}

export async function createOrgSubscription(
  orgId: string,
  subscriptionData: Record<string, unknown>,
) {
  return adminBillingMutate(
    `/api/admin/orgs/${encodeURIComponent(orgId)}/subscriptions`,
    'POST',
    orgId,
    subscriptionData,
  );
}

export async function updateOrgSubscription(
  orgId: string,
  subscriptionId: string,
  updateData: Record<string, unknown>,
) {
  return adminBillingMutate(
    `/api/admin/orgs/${encodeURIComponent(orgId)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    'PUT',
    orgId,
    updateData,
  );
}

export async function cancelOrgSubscription(orgId: string, subscriptionId: string) {
  return adminBillingMutate(
    `/api/admin/orgs/${encodeURIComponent(orgId)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    'DELETE',
    orgId,
  );
}

export async function createOrgGrant(orgId: string, grantData: Record<string, unknown>) {
  return adminBillingMutate(
    `/api/admin/orgs/${encodeURIComponent(orgId)}/grants`,
    'POST',
    orgId,
    grantData,
  );
}

export async function revokeOrgGrant(orgId: string, grantId: string) {
  return adminBillingMutate(
    `/api/admin/orgs/${encodeURIComponent(orgId)}/grants/${encodeURIComponent(grantId)}`,
    'DELETE',
    orgId,
  );
}

export async function grantOrgTrial(orgId: string) {
  return adminBillingMutate(
    `/api/admin/orgs/${encodeURIComponent(orgId)}/grant-trial`,
    'POST',
    orgId,
  );
}

export async function grantOrgSingleProject(orgId: string) {
  return adminBillingMutate(
    `/api/admin/orgs/${encodeURIComponent(orgId)}/grant-single-project`,
    'POST',
    orgId,
  );
}

export async function fetchBillingLedger(
  { limit = 50, status, type } = {} as { limit?: number; status?: string; type?: string },
) {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  const res = await fetch(`/api/admin/billing/ledger?${params.toString()}`, {
    credentials: 'include',
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function fetchBillingStuckStates({ incompleteThreshold = 30, limit = 50 } = {}) {
  const params = new URLSearchParams({
    incompleteThreshold: incompleteThreshold.toString(),
    limit: limit.toString(),
  });
  const res = await fetch(`/api/admin/billing/stuck-states?${params.toString()}`, {
    credentials: 'include',
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function fetchOrgBillingReconcile(
  orgId: string,
  {
    checkStripe = false,
    incompleteThreshold = 30,
    checkoutNoSubThreshold = 15,
    processingLagThreshold = 5,
  } = {},
) {
  const params = new URLSearchParams({
    incompleteThreshold: incompleteThreshold.toString(),
    checkoutNoSubThreshold: checkoutNoSubThreshold.toString(),
    processingLagThreshold: processingLagThreshold.toString(),
  });
  if (checkStripe) params.set('checkStripe', 'true');
  const res = await fetch(
    `/api/admin/orgs/${encodeURIComponent(orgId)}/billing/reconcile?${params.toString()}`,
    { credentials: 'include' },
  );
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function removeProjectMember(projectId: string, memberId: string) {
  const res = await fetch(
    `/api/admin/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
    { method: 'DELETE', credentials: 'include' },
  );
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.projectDetails(projectId) });
  queryClient.invalidateQueries({ queryKey: ['adminProjects'], exact: false });
}

export async function deleteProject(projectId: string) {
  const res = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.projectDetails(projectId) });
  queryClient.invalidateQueries({ queryKey: ['adminProjects'], exact: false });
}
