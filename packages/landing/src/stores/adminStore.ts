/**
 * Admin store for managing admin state and API calls (Zustand)
 *
 * The API functions are plain async functions that use Hono RPC directly.
 * Only the 4 reactive state values are in the Zustand store.
 * checkAdminStatus, checkImpersonationStatus, and stopImpersonation use apiFetch
 * because their endpoints are not on the typed app router.
 */

import { create } from 'zustand';
import { parseResponse } from 'hono/client';
import { api } from '@/lib/rpc';
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
    await parseResponse(
      api.api.admin.users[':userId'].impersonate.$post({
        param: { userId },
        json: { userId },
      }),
    );
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
  return parseResponse(api.api.admin.stats.$get());
}

export async function fetchUsers({ page = 1, limit = 20, search = '' } = {}) {
  const query: Record<string, string> = {
    page: page.toString(),
    limit: limit.toString(),
  };
  if (search) query.search = search;
  return parseResponse(api.api.admin.users.$get({ query }));
}

export async function fetchUserDetails(userId: string) {
  return parseResponse(
    api.api.admin.users[':userId'].$get({ param: { userId } }),
  );
}

export async function banUser(userId: string, reason: string, expiresAt: string | null = null) {
  return parseResponse(
    api.api.admin.users[':userId'].ban.$post({
      param: { userId },
      json: { reason, expiresAt },
    }),
  );
}

export async function unbanUser(userId: string) {
  return parseResponse(
    api.api.admin.users[':userId'].unban.$post({ param: { userId } }),
  );
}

export async function revokeUserSessions(userId: string) {
  return parseResponse(
    api.api.admin.users[':userId'].sessions.$delete({ param: { userId } }),
  );
}

export async function revokeUserSession(userId: string, sessionId: string) {
  return parseResponse(
    api.api.admin.users[':userId'].sessions[':sessionId'].$delete({
      param: { userId, sessionId },
    }),
  );
}

export async function deleteUser(userId: string) {
  return parseResponse(
    api.api.admin.users[':userId'].$delete({ param: { userId } }),
  );
}

export async function fetchStorageDocuments(
  { cursor, limit = 50, prefix = '', search = '' } = {} as {
    cursor?: string;
    limit?: number;
    prefix?: string;
    search?: string;
  },
) {
  const query: Record<string, string> = { limit: limit.toString() };
  if (cursor) query.cursor = cursor;
  if (prefix) query.prefix = prefix;
  if (search) query.search = search;
  return parseResponse(api.api.admin.storage.documents.$get({ query }));
}

export async function deleteStorageDocuments(keys: string[]) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('Keys array is required');
  }
  return parseResponse(
    api.api.admin.storage.documents.$delete({ json: { keys } }),
  );
}

export async function fetchStorageStats() {
  return parseResponse(api.api.admin.storage.stats.$get());
}

export async function fetchOrgs({ page = 1, limit = 20, search = '' } = {}) {
  const query: Record<string, string> = {
    page: page.toString(),
    limit: limit.toString(),
  };
  if (search) query.search = search;
  return parseResponse(api.api.admin.orgs.$get({ query }));
}

export async function fetchOrgDetails(orgId: string) {
  return parseResponse(
    api.api.admin.orgs[':orgId'].$get({ param: { orgId } }),
  );
}

export async function fetchOrgBilling(orgId: string) {
  return parseResponse(
    api.api.admin.orgs[':orgId'].billing.$get({ param: { orgId } }),
  );
}

export async function createOrgSubscription(
  orgId: string,
  subscriptionData: Record<string, unknown>,
) {
  const result = await parseResponse(
    api.api.admin.orgs[':orgId'].subscriptions.$post({
      param: { orgId },
      json: subscriptionData as never,
    }),
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function updateOrgSubscription(
  orgId: string,
  subscriptionId: string,
  updateData: Record<string, unknown>,
) {
  const result = await parseResponse(
    api.api.admin.orgs[':orgId'].subscriptions[':subscriptionId'].$put({
      param: { orgId, subscriptionId },
      json: updateData as never,
    }),
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function cancelOrgSubscription(orgId: string, subscriptionId: string) {
  const result = await parseResponse(
    api.api.admin.orgs[':orgId'].subscriptions[':subscriptionId'].$delete({
      param: { orgId, subscriptionId },
    }),
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function createOrgGrant(orgId: string, grantData: Record<string, unknown>) {
  const result = await parseResponse(
    api.api.admin.orgs[':orgId'].grants.$post({
      param: { orgId },
      json: grantData as never,
    }),
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function updateOrgGrant(
  orgId: string,
  grantId: string,
  updateData: Record<string, unknown>,
) {
  const result = await parseResponse(
    api.api.admin.orgs[':orgId'].grants[':grantId'].$put({
      param: { orgId, grantId },
      json: updateData as never,
    }),
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function revokeOrgGrant(orgId: string, grantId: string) {
  const result = await parseResponse(
    api.api.admin.orgs[':orgId'].grants[':grantId'].$delete({
      param: { orgId, grantId },
    }),
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function grantOrgTrial(orgId: string) {
  const result = await parseResponse(
    api.api.admin.orgs[':orgId']['grant-trial'].$post({ param: { orgId } }),
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function grantOrgSingleProject(orgId: string) {
  const result = await parseResponse(
    api.api.admin.orgs[':orgId']['grant-single-project'].$post({ param: { orgId } }),
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

export async function fetchBillingLedger(
  { limit = 50, status, type } = {} as { limit?: number; status?: string; type?: string },
) {
  const query: Record<string, string> = { limit: limit.toString() };
  if (status) query.status = status;
  if (type) query.type = type;
  return parseResponse(api.api.admin.billing.ledger.$get({ query }));
}

export async function fetchBillingStuckStates({ incompleteThreshold = 30, limit = 50 } = {}) {
  return parseResponse(
    api.api.admin.billing['stuck-states'].$get({
      query: {
        incompleteThreshold: incompleteThreshold.toString(),
        limit: limit.toString(),
      },
    }),
  );
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
  const query: Record<string, string> = {
    incompleteThreshold: incompleteThreshold.toString(),
    checkoutNoSubThreshold: checkoutNoSubThreshold.toString(),
    processingLagThreshold: processingLagThreshold.toString(),
  };
  if (checkStripe) query.checkStripe = 'true';
  return parseResponse(
    api.api.admin.orgs[':orgId'].billing.reconcile.$get({
      param: { orgId },
      query,
    }),
  );
}

export async function fetchProjects({ page = 1, limit = 20, search = '', orgId = '' } = {}) {
  const query: Record<string, string> = {
    page: page.toString(),
    limit: limit.toString(),
  };
  if (search) query.search = search;
  if (orgId) query.orgId = orgId;
  return parseResponse(api.api.admin.projects.$get({ query }));
}

export async function fetchProjectDetails(projectId: string) {
  return parseResponse(
    api.api.admin.projects[':projectId'].$get({ param: { projectId } }),
  );
}

export async function removeProjectMember(projectId: string, memberId: string) {
  await parseResponse(
    api.api.admin.projects[':projectId'].members[':memberId'].$delete({
      param: { projectId, memberId },
    }),
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.projectDetails(projectId) });
  queryClient.invalidateQueries({ queryKey: ['adminProjects'], exact: false });
}

export async function deleteProject(projectId: string) {
  await parseResponse(
    api.api.admin.projects[':projectId'].$delete({ param: { projectId } }),
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.projectDetails(projectId) });
  queryClient.invalidateQueries({ queryKey: ['adminProjects'], exact: false });
}
