import {
  initiateAccountMerge,
  verifyAccountMergeCode,
  completeAccountMerge,
  cancelAccountMerge,
} from '@/server/functions/account-merge.functions';

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
  const data: { targetEmail?: string; targetOrcidId?: string } = {};
  if (targetEmail) {
    data.targetEmail = targetEmail;
  } else if (targetOrcidId) {
    data.targetOrcidId = targetOrcidId;
  } else {
    throw new Error('Either targetEmail or targetOrcidId must be provided');
  }
  return initiateAccountMerge({ data }) as Promise<InitiateResult>;
}

export async function verifyMergeCode(mergeToken: string, code: string) {
  return verifyAccountMergeCode({ data: { mergeToken, code } }) as Promise<VerifyResult>;
}

export async function completeMerge(mergeToken: string) {
  return completeAccountMerge({ data: { mergeToken } }) as Promise<CompleteResult>;
}

export async function cancelMerge(mergeToken: string) {
  return cancelAccountMerge({ data: { mergeToken } }) as Promise<CancelResult>;
}
