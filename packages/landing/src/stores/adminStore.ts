/**
 * Admin store for managing admin state and API calls (Zustand)
 *
 * The API functions are plain async functions that use apiFetch directly.
 * Only the 4 reactive state values are in the Zustand store.
 */

import { create } from 'zustand';
import { apiFetch } from '@/lib/apiFetch';
import { queryClient } from '@/lib/queryClient.js';
import { queryKeys } from '@/lib/queryKeys.js';

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

/* eslint-disable no-unused-vars */
interface AdminActions {
  checkAdminStatus: () => Promise<boolean>;
  checkImpersonationStatus: () => Promise<void>;
  impersonateUser: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}
/* eslint-enable no-unused-vars */

export const useAdminStore = create<AdminState & AdminActions>()(set => ({
  isAdminChecked: false,
  isAdmin: false,
  isImpersonating: false,
  impersonatedBy: null,

  checkAdminStatus: async () => {
    try {
      const data = await apiFetch.get<SessionResponse>('/api/auth/get-session', { toastMessage: false });
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
      const data = await apiFetch.get<SessionResponse>('/api/auth/get-session', { toastMessage: false });
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
    await apiFetch.post(`/api/admin/users/${userId}/impersonate`, null, { toastMessage: false });
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

export async function fetchStats() {
  return apiFetch.get('/api/admin/stats', { toastMessage: false });
}

export async function fetchUsers({ page = 1, limit = 20, search = '' } = {}) {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (search) params.set('search', search);
  return apiFetch.get(`/api/admin/users?${params}`, { toastMessage: false });
}

export async function fetchUserDetails(userId: string) {
  return apiFetch.get(`/api/admin/users/${userId}`, { toastMessage: false });
}

export async function banUser(userId: string, reason: string, expiresAt: string | null = null) {
  return apiFetch.post(
    `/api/admin/users/${userId}/ban`,
    { reason, expiresAt },
    { toastMessage: false },
  );
}

export async function unbanUser(userId: string) {
  return apiFetch.post(`/api/admin/users/${userId}/unban`, null, { toastMessage: false });
}

export async function revokeUserSessions(userId: string) {
  return apiFetch.delete(`/api/admin/users/${userId}/sessions`, { toastMessage: false });
}

export async function revokeUserSession(userId: string, sessionId: string) {
  return apiFetch.delete(`/api/admin/users/${userId}/sessions/${sessionId}`, {
    toastMessage: false,
  });
}

export async function deleteUser(userId: string) {
  return apiFetch.delete(`/api/admin/users/${userId}`, { toastMessage: false });
}

export async function fetchStorageDocuments(
  { cursor, limit = 50, prefix = '', search = '' } = {} as {
    cursor?: string;
    limit?: number;
    prefix?: string;
    search?: string;
  },
) {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (cursor) params.set('cursor', cursor);
  if (prefix) params.set('prefix', prefix);
  if (search) params.set('search', search);
  return apiFetch.get(`/api/admin/storage/documents?${params}`, { toastMessage: false });
}

export async function deleteStorageDocuments(keys: string[]) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('Keys array is required');
  }
  return apiFetch('/api/admin/storage/documents', {
    method: 'DELETE',
    body: { keys },
    toastMessage: false,
  });
}

export async function fetchStorageStats() {
  return apiFetch.get('/api/admin/storage/stats', { toastMessage: false });
}

export async function fetchOrgs({ page = 1, limit = 20, search = '' } = {}) {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (search) params.set('search', search);
  return apiFetch.get(`/api/admin/orgs?${params}`, { toastMessage: false });
}

export async function fetchOrgDetails(orgId: string) {
  return apiFetch.get(`/api/admin/orgs/${orgId}`, { toastMessage: false });
}

export async function fetchOrgBilling(orgId: string) {
  return apiFetch.get(`/api/admin/orgs/${orgId}/billing`, { toastMessage: false });
}

export async function createOrgSubscription(orgId: string, subscriptionData: Record<string, unknown>) {
  const result = await apiFetch.post(`/api/admin/orgs/${orgId}/subscriptions`, subscriptionData, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function updateOrgSubscription(
  orgId: string,
  subscriptionId: string,
  updateData: Record<string, unknown>,
) {
  const result = await apiFetch.put(
    `/api/admin/orgs/${orgId}/subscriptions/${subscriptionId}`,
    updateData,
    { toastMessage: false },
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function cancelOrgSubscription(orgId: string, subscriptionId: string) {
  const result = await apiFetch.delete(`/api/admin/orgs/${orgId}/subscriptions/${subscriptionId}`, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function createOrgGrant(orgId: string, grantData: Record<string, unknown>) {
  const result = await apiFetch.post(`/api/admin/orgs/${orgId}/grants`, grantData, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function updateOrgGrant(orgId: string, grantId: string, updateData: Record<string, unknown>) {
  const result = await apiFetch.put(`/api/admin/orgs/${orgId}/grants/${grantId}`, updateData, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function revokeOrgGrant(orgId: string, grantId: string) {
  const result = await apiFetch.delete(`/api/admin/orgs/${orgId}/grants/${grantId}`, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function grantOrgTrial(orgId: string) {
  const result = await apiFetch.post(`/api/admin/orgs/${orgId}/grant-trial`, null, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function grantOrgSingleProject(orgId: string) {
  const result = await apiFetch.post(`/api/admin/orgs/${orgId}/grant-single-project`, null, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function fetchBillingLedger(
  { limit = 50, status, type } = {} as { limit?: number; status?: string; type?: string },
) {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  return apiFetch.get(`/api/admin/billing/ledger?${params}`, { toastMessage: false });
}

export async function fetchBillingStuckStates({ incompleteThreshold = 30, limit = 50 } = {}) {
  const params = new URLSearchParams({
    incompleteThreshold: incompleteThreshold.toString(),
    limit: limit.toString(),
  });
  return apiFetch.get(`/api/admin/billing/stuck-states?${params}`, { toastMessage: false });
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
  return apiFetch.get(`/api/admin/orgs/${orgId}/billing/reconcile?${params}`, {
    toastMessage: false,
  });
}

export async function fetchProjects({ page = 1, limit = 20, search = '', orgId = '' } = {}) {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (search) params.set('search', search);
  if (orgId) params.set('orgId', orgId);
  return apiFetch.get(`/api/admin/projects?${params}`, { toastMessage: false });
}

export async function fetchProjectDetails(projectId: string) {
  return apiFetch.get(`/api/admin/projects/${projectId}`, { toastMessage: false });
}

export async function removeProjectMember(projectId: string, memberId: string) {
  await apiFetch.delete(`/api/admin/projects/${projectId}/members/${memberId}`, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.projectDetails(projectId) });
  queryClient.invalidateQueries({ queryKey: ['adminProjects'], exact: false });
}

export async function deleteProject(projectId: string) {
  await apiFetch.delete(`/api/admin/projects/${projectId}`, { toastMessage: false });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.projectDetails(projectId) });
  queryClient.invalidateQueries({ queryKey: ['adminProjects'], exact: false });
}
