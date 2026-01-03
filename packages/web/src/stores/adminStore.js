/**
 * Admin store for managing admin state and API calls
 */

import { createSignal } from 'solid-js';
import { API_BASE } from '@config/api.js';
import { handleFetchError } from '@/lib/error-utils.js';
import { queryClient } from '@lib/queryClient.js';
import { queryKeys } from '@lib/queryKeys.js';

// Admin state
const [isAdminChecked, setIsAdminChecked] = createSignal(false);
const [isAdmin, setIsAdmin] = createSignal(false);
const [isImpersonating, setIsImpersonating] = createSignal(false);
const [impersonatedBy, setImpersonatedBy] = createSignal(null);

/**
 * Check if current user is admin and if currently impersonating
 */
async function checkAdminStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/admin/check`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      setIsAdmin(data.isAdmin);
    } else {
      setIsAdmin(false);
    }
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
    const response = await fetch(`${API_BASE}/api/auth/get-session`, {
      credentials: 'include',
    });
    if (!response.ok) {
      setIsImpersonating(false);
      setImpersonatedBy(null);
      return;
    }

    const data = await response.json().catch(() => null);
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
  const response = await fetch(`${API_BASE}/api/admin/stats`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
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

  const response = await fetch(`${API_BASE}/api/admin/users?${params}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}

/**
 * Fetch single user details
 */
async function fetchUserDetails(userId) {
  const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Failed to fetch user details');
  return response.json();
}

/**
 * Ban a user
 */
async function banUser(userId, reason, expiresAt = null) {
  const response = await fetch(`${API_BASE}/api/admin/users/${userId}/ban`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, expiresAt }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to ban user');
  }
  return response.json();
}

/**
 * Unban a user
 */
async function unbanUser(userId) {
  const response = await fetch(`${API_BASE}/api/admin/users/${userId}/unban`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unban user');
  }
  return response.json();
}

/**
 * Impersonate a user
 * Uses Better Auth's admin client for proper cookie handling
 */
async function impersonateUser(userId) {
  const response = await fetch(`${API_BASE}/api/admin/users/${userId}/impersonate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to impersonate user');
  }
  setIsImpersonating(true);
  // Refresh the page to load as the impersonated user
  window.location.href = '/';
}

/**
 * Stop impersonating
 * Uses Better Auth's admin client for proper cookie handling
 */
async function stopImpersonation() {
  const response = await fetch(`${API_BASE}/api/admin/stop-impersonation`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to stop impersonation');
  }
  setIsImpersonating(false);
  // Refresh the page to return to admin
  window.location.href = '/admin';
}

/**
 * Revoke all sessions for a user
 */
async function revokeUserSessions(userId) {
  const response = await fetch(`${API_BASE}/api/admin/users/${userId}/sessions`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to revoke sessions');
  }
  return response.json();
}

/**
 * Delete a user
 */
async function deleteUser(userId) {
  const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete user');
  }
  return response.json();
}

/**
 * Grant subscription to a user
 * @param {string} userId - User ID
 * @param {Object} options - Subscription options
 * @param {string} options.tier - Plan tier ('free', 'pro', 'unlimited')
 * @param {number} [options.currentPeriodEnd] - Expiration timestamp in seconds (optional, null = no expiration)
 */
async function grantAccess(userId, options = {}) {
  const { tier, currentPeriodEnd } = options;
  if (!tier) {
    throw new Error('Tier is required');
  }
  const body = {
    tier,
    status: 'active',
    currentPeriodStart: Math.floor(Date.now() / 1000),
  };
  if (currentPeriodEnd) {
    body.currentPeriodEnd = currentPeriodEnd;
  }

  const response = await handleFetchError(
    fetch(`${API_BASE}/api/admin/users/${userId}/subscription`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { showToast: false },
  );
  const result = await response.json();

  // Invalidate user-specific caches so frontend immediately reflects the change
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.userDetails(userId) });
  queryClient.invalidateQueries({ queryKey: ['adminUsers'] });

  return result;
}

/**
 * Revoke subscription from a user
 */
async function revokeAccess(userId) {
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/admin/users/${userId}/subscription`, {
      method: 'DELETE',
      credentials: 'include',
    }),
    { showToast: false },
  );
  const result = await response.json();

  // Invalidate user-specific caches so frontend immediately reflects the change
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.userDetails(userId) });
  queryClient.invalidateQueries({ queryKey: ['adminUsers'] });

  return result;
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

  const response = await fetch(`${API_BASE}/api/admin/storage/documents?${params}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch storage documents');
  }
  return response.json();
}

/**
 * Delete storage documents (bulk)
 */
async function deleteStorageDocuments(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('Keys array is required');
  }

  const response = await fetch(`${API_BASE}/api/admin/storage/documents`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete storage documents');
  }
  return response.json();
}

/**
 * Fetch storage statistics
 */
async function fetchStorageStats() {
  const response = await fetch(`${API_BASE}/api/admin/storage/stats`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch storage stats');
  }
  return response.json();
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
  deleteUser,
  grantAccess,
  revokeAccess,
  fetchStorageDocuments,
  deleteStorageDocuments,
  fetchStorageStats,
};
