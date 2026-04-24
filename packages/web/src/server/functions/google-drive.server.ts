import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { account, projects, mediaFiles } from '@corates/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  createDomainError,
  isDomainError,
  isPdfSignature,
  PDF_MAGIC_BYTES,
  AUTH_ERRORS,
  FILE_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import { requireProjectEdit } from '@corates/workers/policies/projects';
import { generateUniqueFileName } from '@corates/workers/media-files';
import { getGoogleTokens, getValidAccessToken } from '@/server/googleTokens';
import type { Session } from '@/server/middleware/auth';

export async function getStatus(db: Database, session: Session) {
  const googleAccount = await db
    .select({
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
    })
    .from(account)
    .where(and(eq(account.userId, session.user.id), eq(account.providerId, 'google')))
    .get();

  return {
    connected: !!googleAccount?.accessToken,
    hasRefreshToken: !!googleAccount?.refreshToken,
  };
}

export async function disconnectGoogle(db: Database, session: Session) {
  await db
    .delete(account)
    .where(and(eq(account.userId, session.user.id), eq(account.providerId, 'google')));

  return { success: true as const, message: 'Google account disconnected' };
}

export async function getPickerToken(db: Database, session: Session) {
  const tokens = await getGoogleTokens(db, session.user.id);

  if (!tokens?.accessToken) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.INVALID, {
        context: 'google_not_connected',
        code: 'GOOGLE_NOT_CONNECTED',
      }),
      { status: 401 },
    );
  }

  try {
    const accessToken = await getValidAccessToken(env, db, session.user.id, tokens);
    const updatedTokens = await getGoogleTokens(db, session.user.id);
    const expiresAt = updatedTokens?.accessTokenExpiresAt;

    return {
      accessToken,
      expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt || null,
    };
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('Google Drive picker-token error:', error);
    const err = error as { message?: string; code?: string };
    if (
      (typeof err?.message === 'string' && err.message.includes('reconnect')) ||
      (typeof err?.code === 'string' && err.code.includes('GOOGLE'))
    ) {
      const authError =
        isDomainError(error) ? error : (
          createDomainError(AUTH_ERRORS.INVALID, {
            context: 'google_token_expired',
            originalError: typeof err?.message === 'string' ? err.message : String(error),
          })
        );
      throw Response.json(authError, { status: 401 });
    }
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'get_google_picker_token',
      originalError: typeof err?.message === 'string' ? err.message : String(error),
    });
    throw Response.json(systemError, { status: 500 });
  }
}

export interface ImportResult {
  success: true;
  id: string;
  file: {
    key: string;
    fileName: string;
    originalFileName?: string;
    size: number;
    source: 'google-drive';
  };
}

export async function importFromDrive(
  db: Database,
  session: Session,
  data: { fileId: string; projectId: string; studyId: string },
): Promise<ImportResult> {
  const { fileId, projectId, studyId } = data;

  try {
    await requireProjectEdit(db, session.user.id, projectId);
  } catch (err) {
    if (isDomainError(err)) {
      throw Response.json(err, { status: 403 });
    }
    throw err;
  }

  const tokens = await getGoogleTokens(db, session.user.id);
  if (!tokens?.accessToken) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.INVALID, {
        context: 'google_not_connected',
        code: 'GOOGLE_NOT_CONNECTED',
      }),
      { status: 401 },
    );
  }

  try {
    const accessToken = await getValidAccessToken(env, db, session.user.id, tokens);

    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!metaResponse.ok) {
      if (metaResponse.status === 404) {
        throw Response.json(
          createDomainError(FILE_ERRORS.NOT_FOUND, {
            fileName: fileId,
            source: 'google-drive',
          }),
          { status: 404 },
        );
      }
      throw Response.json(
        createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
          operation: 'fetch_google_drive_file',
          originalError: `HTTP ${metaResponse.status}`,
        }),
        { status: 500 },
      );
    }

    const fileMeta = (await metaResponse.json()) as {
      id: string;
      name: string;
      mimeType: string;
      size?: string;
    };

    if (fileMeta.mimeType !== 'application/pdf') {
      throw Response.json(
        createDomainError(FILE_ERRORS.INVALID_TYPE, {
          expectedType: 'application/pdf',
          receivedType: fileMeta.mimeType,
        }),
        { status: 400 },
      );
    }

    const maxSize = 50 * 1024 * 1024;
    if (fileMeta.size && parseInt(fileMeta.size, 10) > maxSize) {
      throw Response.json(
        createDomainError(FILE_ERRORS.TOO_LARGE, {
          maxSize: maxSize,
          fileSize: parseInt(fileMeta.size, 10),
        }),
        { status: 413 },
      );
    }

    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!downloadResponse.ok) {
      throw Response.json(
        createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
          operation: 'download_google_drive_file',
          originalError: `HTTP ${downloadResponse.status}`,
        }),
        { status: 500 },
      );
    }

    const fileContent = await downloadResponse.arrayBuffer();

    const header = new Uint8Array(fileContent.slice(0, PDF_MAGIC_BYTES.length));
    if (!isPdfSignature(header)) {
      throw Response.json(
        createDomainError(FILE_ERRORS.INVALID_TYPE, {
          expectedType: 'application/pdf',
          receivedType: 'unknown (invalid PDF signature)',
          source: 'google-drive',
        }),
        { status: 400 },
      );
    }

    const project = await db
      .select({ orgId: projects.orgId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      throw Response.json(
        createDomainError(SYSTEM_ERRORS.DB_ERROR, {
          operation: 'fetch_project_for_import',
          projectId,
          message: 'Project not found',
        }),
        { status: 404 },
      );
    }

    const originalFileName = fileMeta.name;
    const uniqueFileName = await generateUniqueFileName(fileMeta.name, projectId, studyId, db);
    const r2Key = `projects/${projectId}/studies/${studyId}/${uniqueFileName}`;
    const fileSize = fileContent.byteLength;

    await env.PDF_BUCKET.put(r2Key, fileContent, {
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata: {
        originalName: originalFileName,
        importedFrom: 'google-drive',
        googleDriveFileId: fileId,
        uploadedBy: session.user.id,
        uploadedAt: new Date().toISOString(),
      },
    });

    const mediaFileId = crypto.randomUUID();
    try {
      await db.insert(mediaFiles).values({
        id: mediaFileId,
        filename: uniqueFileName,
        originalName: originalFileName,
        fileType: 'application/pdf',
        fileSize,
        uploadedBy: session.user.id,
        bucketKey: r2Key,
        orgId: project.orgId,
        projectId,
        studyId,
        createdAt: new Date(),
      });
    } catch (dbError) {
      console.error('Failed to insert mediaFiles record after Google Drive import:', dbError);
    }

    return {
      success: true as const,
      id: mediaFileId,
      file: {
        key: r2Key,
        fileName: uniqueFileName,
        originalFileName: originalFileName !== uniqueFileName ? originalFileName : undefined,
        size: fileSize,
        source: 'google-drive' as const,
      },
    };
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('Google Drive import error:', error);
    if (isDomainError(error)) {
      throw Response.json(error, { status: 400 });
    }
    const err = error as Error;
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'import_google_drive_file',
        originalError: typeof err?.message === 'string' ? err.message : String(error),
      }),
      { status: 500 },
    );
  }
}
