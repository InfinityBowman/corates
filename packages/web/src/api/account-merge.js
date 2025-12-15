/**
 * Account Merge API
 *
 * Handles the self-service account merge flow when a user owns
 * multiple accounts and wants to combine them.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

/**
 * Initiate a merge request
 * @param {string} targetEmail - Email of the account to merge with
 * @returns {Promise<{ success: boolean, mergeToken: string, targetEmail: string, preview: { currentProviders: string[] } }>}
 */
export async function initiateMerge(targetEmail) {
  const response = await fetch(`${API_BASE}/api/accounts/merge/initiate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetEmail }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to initiate merge');
  }

  return data;
}

/**
 * Verify the code sent to the target email
 * @param {string} mergeToken - The merge token from initiate
 * @param {string} code - The 6-digit verification code
 * @returns {Promise<{ success: boolean, message: string, preview: { currentProviders: string[], targetProviders: string[] } }>}
 */
export async function verifyMergeCode(mergeToken, code) {
  const response = await fetch(`${API_BASE}/api/accounts/merge/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mergeToken, code }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to verify code');
  }

  return data;
}

/**
 * Complete the merge (called by initiator after verification)
 * @param {string} mergeToken - The merge token from initiate
 * @returns {Promise<{ success: boolean, message: string, mergedProviders: string[] }>}
 */
export async function completeMerge(mergeToken) {
  const response = await fetch(`${API_BASE}/api/accounts/merge/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mergeToken }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to complete merge');
  }

  return data;
}

/**
 * Check merge request status
 * @param {string} mergeToken - The merge token
 * @returns {Promise<{ status: string, initiatorEmail: string, targetEmail: string, isInitiator: boolean, verified: boolean }>}
 */
export async function getMergeStatus(mergeToken) {
  const response = await fetch(
    `${API_BASE}/api/accounts/merge/status?token=${encodeURIComponent(mergeToken)}`,
    {
      method: 'GET',
      credentials: 'include',
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to get merge status');
  }

  return data;
}

/**
 * Cancel a pending merge request
 * @param {string} mergeToken - The merge token
 * @returns {Promise<{ success: boolean }>}
 */
export async function cancelMerge(mergeToken) {
  const response = await fetch(`${API_BASE}/api/accounts/merge/cancel`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mergeToken }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to cancel merge');
  }

  return data;
}
