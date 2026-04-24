/**
 * Admin store for managing admin state and API calls (Zustand)
 *
 * Only the 4 reactive state values are in the Zustand store.
 * checkAdminStatus and checkImpersonationStatus use apiFetch
 * because their endpoints are not on the typed app router.
 */

import { create } from 'zustand';
import { apiFetch } from '@/lib/apiFetch';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import {
  banUserAction,
  unbanUserAction,
  revokeAllSessionsAction,
  revokeSessionAction,
  deleteUserAction,
  impersonateUserAction,
  stopImpersonationAction,
} from '@/server/functions/admin-users.functions';
import {
  getAdminOrgBillingReconcileAction,
  createGrantAction,
  revokeGrantAction,
  grantTrialAction,
  grantSingleProjectAction,
  createSubscriptionAction,
  updateSubscriptionAction,
  cancelSubscriptionAction,
} from '@/server/functions/admin-orgs.functions';

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
    await impersonateUserAction({ data: { userId } });
    set({ isImpersonating: true });
    window.location.href = '/';
  },

  stopImpersonation: async () => {
    await stopImpersonationAction();
    set({ isImpersonating: false });
    window.location.href = '/admin';
  },
}));

// Admin API functions (plain async, no store state needed)

export async function banUser(userId: string, reason: string, expiresAt: string | null = null) {
  return banUserAction({ data: { userId, reason, expiresAt } });
}

export async function unbanUser(userId: string) {
  return unbanUserAction({ data: { userId } });
}

export async function revokeUserSessions(userId: string) {
  return revokeAllSessionsAction({ data: { userId } });
}

export async function revokeUserSession(userId: string, sessionId: string) {
  return revokeSessionAction({ data: { userId, sessionId } });
}

export async function deleteUser(userId: string) {
  return deleteUserAction({ data: { userId } });
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

export async function createOrgSubscription(
  orgId: string,
  subscriptionData: Record<string, unknown>,
) {
  const result = await createSubscriptionAction({
    data: { orgId, ...subscriptionData } as Parameters<typeof createSubscriptionAction>[0]['data'],
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
  const result = await updateSubscriptionAction({
    data: {
      orgId,
      subscriptionId,
      ...updateData,
    } as Parameters<typeof updateSubscriptionAction>[0]['data'],
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function cancelOrgSubscription(orgId: string, subscriptionId: string) {
  const result = await cancelSubscriptionAction({ data: { orgId, subscriptionId } });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function createOrgGrant(orgId: string, grantData: Record<string, unknown>) {
  const result = await createGrantAction({
    data: { orgId, ...grantData } as Parameters<typeof createGrantAction>[0]['data'],
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function revokeOrgGrant(orgId: string, grantId: string) {
  const result = await revokeGrantAction({ data: { orgId, grantId } });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function grantOrgTrial(orgId: string) {
  const result = await grantTrialAction({ data: { orgId } });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function grantOrgSingleProject(orgId: string) {
  const result = await grantSingleProjectAction({ data: { orgId } });
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
  return getAdminOrgBillingReconcileAction({
    data: {
      orgId,
      checkStripe,
      incompleteThreshold,
      checkoutNoSubThreshold,
      processingLagThreshold,
    },
  });
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
