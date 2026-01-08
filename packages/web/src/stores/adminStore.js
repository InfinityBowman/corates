/**
 * Admin store for managing admin state and API calls
 */

import { createSignal } from 'solid-js';
import { apiFetch } from '@/lib/apiFetch.js';
import { queryClient } from '@lib/queryClient.js';
import { queryKeys } from '@lib/queryKeys.js';

// Admin state
const [isAdminChecked, setIsAdminChecked] = createSignal(false);
const [isAdmin, setIsAdmin] = createSignal(false);
const [isImpersonating, setIsImpersonating] = createSignal(false);
const [impersonatedBy, setImpersonatedBy] = createSignal(null);

/**
 * Check if current user is admin based on session data.
 * Uses the existing session endpoint to avoid unnecessary admin-protected calls.
 */
async function checkAdminStatus() {
  try {
    const data = await apiFetch.get('/api/auth/get-session', { toastMessage: false });
    // Check if user has admin role
    setIsAdmin(data?.user?.role === 'admin');
  } catch {
    setIsAdmin(false);
  } finally {
    setIsAdminChecked(true);
  }
  return isAdmin();
}

/**
 * Check if session is impersonated (call on app init)
 */
async function checkImpersonationStatus() {
  try {
    const data = await apiFetch.get('/api/auth/get-session', { toastMessage: false });
    if (data?.session?.impersonatedBy) {
      setIsImpersonating(true);
      setImpersonatedBy(data.session.impersonatedBy);
      return;
    }

    setIsImpersonating(false);
    setImpersonatedBy(null);
  } catch (err) {
    setIsImpersonating(false);
    setImpersonatedBy(null);
    console.error('[Admin] Error checking impersonation status:', err);
  }
}

/**
 * Fetch admin dashboard stats
 */
async function fetchStats() {
  return apiFetch.get('/api/admin/stats', { toastMessage: false });
}

/**
 * Fetch users with pagination and search
 */
async function fetchUsers({ page = 1, limit = 20, search = '' } = {}) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) params.set('search', search);

  return apiFetch.get(`/api/admin/users?${params}`, { toastMessage: false });
}

/**
 * Fetch single user details
 */
async function fetchUserDetails(userId) {
  return apiFetch.get(`/api/admin/users/${userId}`, { toastMessage: false });
}

/**
 * Ban a user
 */
async function banUser(userId, reason, expiresAt = null) {
  return apiFetch.post(
    `/api/admin/users/${userId}/ban`,
    { reason, expiresAt },
    { toastMessage: false },
  );
}

/**
 * Unban a user
 */
async function unbanUser(userId) {
  return apiFetch.post(`/api/admin/users/${userId}/unban`, null, { toastMessage: false });
}

/**
 * Impersonate a user
 * Uses Better Auth's admin client for proper cookie handling
 */
async function impersonateUser(userId) {
  await apiFetch.post(`/api/admin/users/${userId}/impersonate`, null, { toastMessage: false });
  setIsImpersonating(true);
  // Refresh the page to load as the impersonated user
  window.location.href = '/';
}

/**
 * Stop impersonating
 * Uses Better Auth's admin client for proper cookie handling
 */
async function stopImpersonation() {
  await apiFetch.post('/api/admin/stop-impersonation', null, { toastMessage: false });
  setIsImpersonating(false);
  // Refresh the page to return to admin
  window.location.href = '/admin';
}

/**
 * Revoke all sessions for a user
 */
async function revokeUserSessions(userId) {
  return apiFetch.delete(`/api/admin/users/${userId}/sessions`, { toastMessage: false });
}

/**
 * Revoke a specific session for a user
 */
async function revokeUserSession(userId, sessionId) {
  return apiFetch.delete(`/api/admin/users/${userId}/sessions/${sessionId}`, {
    toastMessage: false,
  });
}

/**
 * Delete a user
 */
async function deleteUser(userId) {
  return apiFetch.delete(`/api/admin/users/${userId}`, { toastMessage: false });
}

/**
 * Fetch storage documents with cursor-based pagination
 */
async function fetchStorageDocuments({ cursor, limit = 50, prefix = '', search = '' } = {}) {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });
  if (cursor) params.set('cursor', cursor);
  if (prefix) params.set('prefix', prefix);
  if (search) params.set('search', search);

  return apiFetch.get(`/api/admin/storage/documents?${params}`, { toastMessage: false });
}

/**
 * Delete storage documents (bulk)
 */
async function deleteStorageDocuments(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('Keys array is required');
  }

  return apiFetch.delete('/api/admin/storage/documents', { keys }, { toastMessage: false });
}

/**
 * Fetch storage statistics
 */
async function fetchStorageStats() {
  return apiFetch.get('/api/admin/storage/stats', { toastMessage: false });
}

/**
 * Fetch orgs with pagination and search
 */
async function fetchOrgs({ page = 1, limit = 20, search = '' } = {}) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) params.set('search', search);

  return apiFetch.get(`/api/admin/orgs?${params}`, { toastMessage: false });
}

/**
 * Fetch single org details with billing summary
 */
async function fetchOrgDetails(orgId) {
  return apiFetch.get(`/api/admin/orgs/${orgId}`, { toastMessage: false });
}

/**
 * Fetch org billing details
 */
async function fetchOrgBilling(orgId) {
  return apiFetch.get(`/api/admin/orgs/${orgId}/billing`, { toastMessage: false });
}

/**
 * Create subscription for an org
 */
async function createOrgSubscription(orgId, subscriptionData) {
  const result = await apiFetch.post(`/api/admin/orgs/${orgId}/subscriptions`, subscriptionData, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

/**
 * Update subscription for an org
 */
async function updateOrgSubscription(orgId, subscriptionId, updateData) {
  const result = await apiFetch.put(
    `/api/admin/orgs/${orgId}/subscriptions/${subscriptionId}`,
    updateData,
    { toastMessage: false },
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

/**
 * Cancel subscription for an org
 */
async function cancelOrgSubscription(orgId, subscriptionId) {
  const result = await apiFetch.delete(
    `/api/admin/orgs/${orgId}/subscriptions/${subscriptionId}`,
    null,
    { toastMessage: false },
  );
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

/**
 * Create grant for an org
 */
async function createOrgGrant(orgId, grantData) {
  const result = await apiFetch.post(`/api/admin/orgs/${orgId}/grants`, grantData, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

/**
 * Update grant for an org
 */
async function updateOrgGrant(orgId, grantId, updateData) {
  const result = await apiFetch.put(`/api/admin/orgs/${orgId}/grants/${grantId}`, updateData, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

/**
 * Revoke grant for an org
 */
async function revokeOrgGrant(orgId, grantId) {
  const result = await apiFetch.delete(`/api/admin/orgs/${orgId}/grants/${grantId}`, null, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

/**
 * Quick action: Grant trial to org
 */
async function grantOrgTrial(orgId) {
  const result = await apiFetch.post(`/api/admin/orgs/${orgId}/grant-trial`, null, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

/**
 * Quick action: Grant single_project to org
 */
async function grantOrgSingleProject(orgId) {
  const result = await apiFetch.post(`/api/admin/orgs/${orgId}/grant-single-project`, null, {
    toastMessage: false,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
  return result;
}

/**
 * Fetch Stripe event ledger entries
 */
async function fetchBillingLedger({ limit = 50, status, type } = {}) {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (status) params.set('status', status);
  if (type) params.set('type', type);

  return apiFetch.get(`/api/admin/billing/ledger?${params}`, { toastMessage: false });
}

/**
 * Fetch orgs with stuck billing states
 */
async function fetchBillingStuckStates({ incompleteThreshold = 30, limit = 50 } = {}) {
  const params = new URLSearchParams({
    incompleteThreshold: incompleteThreshold.toString(),
    limit: limit.toString(),
  });

  return apiFetch.get(`/api/admin/billing/stuck-states?${params}`, { toastMessage: false });
}

/**
 * Fetch org billing reconciliation results
 */
async function fetchOrgBillingReconcile(
  orgId,
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

/**
 * Fetch projects with pagination and search
 */
async function fetchProjects({ page = 1, limit = 20, search = '', orgId = '' } = {}) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) params.set('search', search);
  if (orgId) params.set('orgId', orgId);

  return apiFetch.get(`/api/admin/projects?${params}`, { toastMessage: false });
}

/**
 * Fetch single project details
 */
async function fetchProjectDetails(projectId) {
  return apiFetch.get(`/api/admin/projects/${projectId}`, { toastMessage: false });
}

/**
 * Remove a member from a project
 */
async function removeProjectMember(projectId, memberId) {
  return apiFetch.delete(`/api/admin/projects/${projectId}/members/${memberId}`, {
    toastMessage: false,
  });
}

/**
 * Delete a project
 */
async function deleteProject(projectId) {
  return apiFetch.delete(`/api/admin/projects/${projectId}`, { toastMessage: false });
}

export {
  isAdmin,
  isAdminChecked,
  isImpersonating,
  impersonatedBy,
  checkAdminStatus,
  checkImpersonationStatus,
  fetchStats,
  fetchUsers,
  fetchUserDetails,
  banUser,
  unbanUser,
  impersonateUser,
  stopImpersonation,
  revokeUserSessions,
  revokeUserSession,
  deleteUser,
  fetchStorageDocuments,
  deleteStorageDocuments,
  fetchStorageStats,
  fetchOrgs,
  fetchOrgDetails,
  fetchOrgBilling,
  createOrgSubscription,
  updateOrgSubscription,
  cancelOrgSubscription,
  createOrgGrant,
  updateOrgGrant,
  revokeOrgGrant,
  grantOrgTrial,
  grantOrgSingleProject,
  fetchBillingLedger,
  fetchBillingStuckStates,
  fetchOrgBillingReconcile,
  fetchProjects,
  fetchProjectDetails,
  removeProjectMember,
  deleteProject,
};
