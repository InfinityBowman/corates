/**
 * Account Merge API
 *
 * Handles the self-service account merge flow when a user owns
 * multiple accounts and wants to combine them.
 */

import { parseResponse } from 'hono/client';
import { api } from '@/lib/rpc';

export async function initiateMerge(
  targetEmail: string | null,
  targetOrcidId: string | null,
) {
  const body: Record<string, string> = {};
  if (targetEmail) {
    body.targetEmail = targetEmail;
  } else if (targetOrcidId) {
    body.targetOrcidId = targetOrcidId;
  } else {
    throw new Error('Either targetEmail or targetOrcidId must be provided');
  }

  return parseResponse(api.api.accounts.merge.initiate.$post({ json: body }));
}

export async function verifyMergeCode(mergeToken: string, code: string) {
  return parseResponse(
    api.api.accounts.merge.verify.$post({ json: { mergeToken, code } }),
  );
}

export async function completeMerge(mergeToken: string) {
  return parseResponse(
    api.api.accounts.merge.complete.$post({ json: { mergeToken } }),
  );
}

export async function cancelMerge(mergeToken: string) {
  return parseResponse(
    api.api.accounts.merge.cancel.$delete({ json: { mergeToken } }),
  );
}
