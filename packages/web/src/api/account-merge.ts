/**
 * Account Merge API
 *
 * Handles the self-service account merge flow when a user owns
 * multiple accounts and wants to combine them.
 */

import { API_BASE } from '@/config/api';

async function postJson<T>(path: string, body: unknown, method: 'POST' | 'DELETE' = 'POST'): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; code?: string };
  if (!res.ok) {
    const err = new Error(
      (data && (data.message || data.code)) || `${method} ${path} failed: ${res.status}`,
    );
    (err as unknown as { response?: unknown }).response = data;
    throw err;
  }
  return data;
}

interface InitiateResult {
  success: true;
  mergeToken: string;
  targetEmail: string;
  targetOrcidId: string | null;
  preview: { currentProviders: string[] };
}

interface VerifyResult {
  success: true;
  message: string;
  preview: { currentProviders: string[]; targetProviders: string[] };
}

interface CompleteResult {
  success: true;
  message: string;
  mergedProviders: string[];
}

interface CancelResult {
  success: true;
}

export async function initiateMerge(targetEmail: string | null, targetOrcidId: string | null) {
  const body: Record<string, string> = {};
  if (targetEmail) {
    body.targetEmail = targetEmail;
  } else if (targetOrcidId) {
    body.targetOrcidId = targetOrcidId;
  } else {
    throw new Error('Either targetEmail or targetOrcidId must be provided');
  }
  return postJson<InitiateResult>('/api/accounts/merge/initiate', body);
}

export async function verifyMergeCode(mergeToken: string, code: string) {
  return postJson<VerifyResult>('/api/accounts/merge/verify', { mergeToken, code });
}

export async function completeMerge(mergeToken: string) {
  return postJson<CompleteResult>('/api/accounts/merge/complete', { mergeToken });
}

export async function cancelMerge(mergeToken: string) {
  return postJson<CancelResult>('/api/accounts/merge/cancel', { mergeToken }, 'DELETE');
}
