/**
 * Account Merge API
 *
 * Handles the self-service account merge flow when a user owns
 * multiple accounts and wants to combine them.
 */

import { apiFetch } from '@/lib/apiFetch';

interface MergeInitiateResult {
  success: boolean;
  mergeToken: string;
  targetEmail: string;
  targetOrcidId?: string;
  preview: { currentProviders: string[] };
}

interface MergeVerifyResult {
  success: boolean;
  message: string;
  preview: { currentProviders: string[]; targetProviders: string[] };
}

interface MergeCompleteResult {
  success: boolean;
  message: string;
  mergedProviders: string[];
}

interface MergeStatus {
  status: string;
  initiatorEmail: string;
  targetEmail: string;
  isInitiator: boolean;
  verified: boolean;
}

export async function initiateMerge(
  targetEmail: string | null,
  targetOrcidId: string | null,
): Promise<MergeInitiateResult> {
  const body: Record<string, string> = {};
  if (targetEmail) {
    body.targetEmail = targetEmail;
  } else if (targetOrcidId) {
    body.targetOrcidId = targetOrcidId;
  } else {
    throw new Error('Either targetEmail or targetOrcidId must be provided');
  }

  return apiFetch.post<MergeInitiateResult>('/api/accounts/merge/initiate', body);
}

export async function verifyMergeCode(
  mergeToken: string,
  code: string,
): Promise<MergeVerifyResult> {
  return apiFetch.post<MergeVerifyResult>('/api/accounts/merge/verify', { mergeToken, code });
}

export async function completeMerge(mergeToken: string): Promise<MergeCompleteResult> {
  return apiFetch.post<MergeCompleteResult>('/api/accounts/merge/complete', { mergeToken });
}

export async function getMergeStatus(mergeToken: string): Promise<MergeStatus> {
  return apiFetch.get<MergeStatus>(
    `/api/accounts/merge/status?token=${encodeURIComponent(mergeToken)}`,
  );
}

export async function cancelMerge(mergeToken: string): Promise<{ success: boolean }> {
  return apiFetch.delete<{ success: boolean }>('/api/accounts/merge/cancel', {
    body: { mergeToken },
  });
}
