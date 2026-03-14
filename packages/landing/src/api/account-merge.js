/**
 * Account Merge API
 *
 * Handles the self-service account merge flow when a user owns
 * multiple accounts and wants to combine them.
 */

import { apiFetch } from '@/lib/apiFetch.js';

/**
 * Initiate a merge request
 * @param {string} targetEmail - Email of the account to merge with
 * @param {string} targetOrcidId - ORCID ID of the account to merge with (alternative to targetEmail)
 * @returns {Promise<{ success: boolean, mergeToken: string, targetEmail: string, targetOrcidId?: string, preview: { currentProviders: string[] } }>}
 */
export async function initiateMerge(targetEmail, targetOrcidId) {
  const body = {};
  if (targetEmail) {
    body.targetEmail = targetEmail;
  } else if (targetOrcidId) {
    body.targetOrcidId = targetOrcidId;
  } else {
    throw new Error('Either targetEmail or targetOrcidId must be provided');
  }

  return apiFetch.post('/api/accounts/merge/initiate', body);
}

/**
 * Verify the code sent to the target email
 * @param {string} mergeToken - The merge token from initiate
 * @param {string} code - The 6-digit verification code
 * @returns {Promise<{ success: boolean, message: string, preview: { currentProviders: string[], targetProviders: string[] } }>}
 */
export async function verifyMergeCode(mergeToken, code) {
  return apiFetch.post('/api/accounts/merge/verify', { mergeToken, code });
}

/**
 * Complete the merge (called by initiator after verification)
 * @param {string} mergeToken - The merge token from initiate
 * @returns {Promise<{ success: boolean, message: string, mergedProviders: string[] }>}
 */
export async function completeMerge(mergeToken) {
  return apiFetch.post('/api/accounts/merge/complete', { mergeToken });
}

/**
 * Check merge request status
 * @param {string} mergeToken - The merge token
 * @returns {Promise<{ status: string, initiatorEmail: string, targetEmail: string, isInitiator: boolean, verified: boolean }>}
 */
export async function getMergeStatus(mergeToken) {
  return apiFetch.get(`/api/accounts/merge/status?token=${encodeURIComponent(mergeToken)}`);
}

/**
 * Cancel a pending merge request
 * @param {string} mergeToken - The merge token
 * @returns {Promise<{ success: boolean }>}
 */
export async function cancelMerge(mergeToken) {
  return apiFetch.delete('/api/accounts/merge/cancel', { body: { mergeToken } });
}
