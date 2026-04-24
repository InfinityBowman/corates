import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { mediaFiles } from '@corates/db/schema';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { isAdminUser } from '@corates/workers/auth-admin';
import type { Session } from '@/server/middleware/auth';

function assertAdmin(session: Session) {
  if (!isAdminUser(session.user as { role?: string | null })) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' }),
      { status: 403 },
    );
  }
}

const R2_KEY_PATTERN = /^projects\/[^/]+\/studies\/[^/]+\/.+$/;

function parseKey(key: string): { projectId: string; studyId: string; fileName: string } | null {
  const match = key.match(/^projects\/([^/]+)\/studies\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { projectId: match[1], studyId: match[2], fileName: match[3] };
}

export async function getAdminStorageStats(session: Session) {
  assertAdmin(session);

  let cursor: string | undefined = undefined;
  let totalFiles = 0;
  let totalSize = 0;
  const filesByProject: Record<string, number> = {};

  let done = false;
  while (!done) {
    const listed = (await env.PDF_BUCKET.list({ limit: 1000, cursor })) as {
      objects: Array<{ key: string; size: number }>;
      truncated: boolean;
      cursor?: string;
    };

    for (const obj of listed.objects) {
      totalFiles++;
      totalSize += obj.size;

      const parsed = parseKey(obj.key);
      if (parsed) {
        filesByProject[parsed.projectId] = (filesByProject[parsed.projectId] || 0) + 1;
      }
    }

    if (listed.truncated) {
      cursor = listed.cursor;
    } else {
      done = true;
    }
  }

  return {
    totalFiles,
    totalSize,
    filesByProject: Object.entries(filesByProject).map(([projectId, count]) => ({
      projectId,
      count,
    })),
  };
}

interface StorageDoc {
  key: string;
  fileName: string;
  projectId: string;
  studyId: string;
  size: number;
  uploaded: Date;
  etag: string;
}

export async function listAdminStorageDocuments(
  session: Session,
  db: Database,
  params: { cursor?: string; limit?: number; prefix?: string; search?: string },
) {
  assertAdmin(session);

  const requestCursor = params.cursor?.trim() || undefined;
  const rawLimit = params.limit ?? 50;
  if (rawLimit < 1 || rawLimit > 1000) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'invalid_limit' }),
      { status: 400 },
    );
  }
  const limit = Math.min(Math.max(rawLimit, 1), 1000);
  const prefix = params.prefix?.trim() || '';
  const search = params.search?.trim().toLowerCase() || '';

  let r2Cursor: string | undefined = undefined;
  let skipCount = 0;
  if (requestCursor) {
    try {
      const decoded = JSON.parse(requestCursor) as { r2Cursor?: string; skipCount?: number };
      r2Cursor = decoded.r2Cursor;
      skipCount = Math.max(0, decoded.skipCount || 0);
      if (!r2Cursor) skipCount = 0;
    } catch {
      r2Cursor = requestCursor;
      skipCount = 0;
    }
  }

  const PROCESSING_CAP = 10000;
  const matchingObjects: StorageDoc[] = [];
  let currentCursor = r2Cursor;
  let objectsProcessed = 0;
  let truncated = false;
  let listedTruncated = false;

  while (matchingObjects.length < skipCount + limit && objectsProcessed < PROCESSING_CAP) {
    const listOptions: { limit: number; prefix?: string; cursor?: string } = {
      limit: 1000,
      prefix: prefix || undefined,
    };
    if (currentCursor) listOptions.cursor = currentCursor;

    const listed = await env.PDF_BUCKET.list(listOptions);

    if (listed.objects.length === 0) {
      listedTruncated = false;
      break;
    }

    objectsProcessed += listed.objects.length;

    for (const obj of listed.objects) {
      const parsed = parseKey(obj.key);
      if (!parsed) continue;
      if (search && !parsed.fileName.toLowerCase().includes(search)) continue;

      matchingObjects.push({
        key: obj.key,
        fileName: parsed.fileName,
        projectId: parsed.projectId,
        studyId: parsed.studyId,
        size: obj.size,
        uploaded: obj.uploaded,
        etag: obj.etag,
      });
    }

    if (listed.truncated) {
      currentCursor = listed.cursor;
      listedTruncated = true;
    } else {
      listedTruncated = false;
      break;
    }

    if (objectsProcessed >= PROCESSING_CAP) {
      truncated = true;
      break;
    }
  }

  skipCount = Math.min(skipCount, matchingObjects.length);
  const paginatedObjects = matchingObjects.slice(skipCount, skipCount + limit);

  const trackedKeys = await db.select({ bucketKey: mediaFiles.bucketKey }).from(mediaFiles);
  const trackedKeysSet = new Set(trackedKeys.map(row => row.bucketKey));

  const documentsWithOrphanStatus = paginatedObjects.map(doc => ({
    ...doc,
    orphaned: !trackedKeysSet.has(doc.key),
  }));

  const response: {
    documents: typeof documentsWithOrphanStatus;
    limit: number;
    nextCursor?: string;
    truncated?: boolean;
  } = {
    documents: documentsWithOrphanStatus,
    limit,
  };

  const hasMoreR2Objects = listedTruncated && currentCursor;
  const canContinueAfterCap = truncated && currentCursor;

  if (hasMoreR2Objects || canContinueAfterCap) {
    const nextSkipCount = Math.max(0, skipCount + paginatedObjects.length);
    response.nextCursor = JSON.stringify({
      r2Cursor: currentCursor,
      skipCount: nextSkipCount,
    });
  }

  if (truncated) response.truncated = true;

  return response;
}

export async function deleteAdminStorageDocuments(
  session: Session,
  params: { keys: string[] },
) {
  assertAdmin(session);

  const { keys } = params;

  if (!Array.isArray(keys) || keys.length === 0) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'keys_required' }),
      { status: 400 },
    );
  }

  for (const k of keys) {
    if (typeof k !== 'string' || !R2_KEY_PATTERN.test(k)) {
      throw Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'invalid_key_format' }),
        { status: 400 },
      );
    }
  }

  const deleteResults = await Promise.allSettled(keys.map(key => env.PDF_BUCKET.delete(key)));

  const deleted = deleteResults.filter(r => r.status === 'fulfilled').length;
  const failed = deleteResults.filter(r => r.status === 'rejected').length;

  let errors: Array<{ key: string; error: string }> | undefined;
  if (failed > 0) {
    errors = [];
    deleteResults.forEach((result, i) => {
      if (result.status === 'rejected') {
        errors!.push({
          key: keys[i],
          error: (result.reason as Error)?.message || 'Unknown error',
        });
      }
    });
  }

  return { deleted, failed, errors };
}
