import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDb } from '@corates/db/client';
import { projects, mediaFiles } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  isDomainError,
  isPdfSignature,
  PDF_MAGIC_BYTES,
  AUTH_ERRORS,
  FILE_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { requireProjectEdit } from '@corates/workers/policies/projects';
import { generateUniqueFileName } from '@corates/workers/media-files';
import { getGoogleTokens, getValidAccessToken } from '@/server/googleTokens';

export const handler = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  let body: { fileId?: unknown; projectId?: unknown; studyId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code, null);
    error.message = 'Invalid JSON input';
    return Response.json(error, { status: 400 });
  }

  const { fileId, projectId, studyId } = body;
  if (typeof fileId !== 'string' || fileId.length < 1) {
    return Response.json(
      createValidationError('fileId', VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'required'),
      { status: 400 },
    );
  }
  if (typeof projectId !== 'string' || projectId.length < 1) {
    return Response.json(
      createValidationError('projectId', VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'required'),
      { status: 400 },
    );
  }
  if (typeof studyId !== 'string' || studyId.length < 1) {
    return Response.json(
      createValidationError('studyId', VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'required'),
      { status: 400 },
    );
  }

  const db = createDb(env.DB);

  try {
    await requireProjectEdit(db, session.user.id, projectId);
  } catch (err) {
    if (isDomainError(err)) {
      return Response.json(err, { status: 403 });
    }
    throw err;
  }

  const tokens = await getGoogleTokens(db, session.user.id);
  if (!tokens?.accessToken) {
    const error = createDomainError(AUTH_ERRORS.INVALID, {
      context: 'google_not_connected',
      code: 'GOOGLE_NOT_CONNECTED',
    });
    return Response.json(error, { status: 401 });
  }

  try {
    const accessToken = await getValidAccessToken(env, db, session.user.id, tokens);

    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!metaResponse.ok) {
      if (metaResponse.status === 404) {
        const error = createDomainError(FILE_ERRORS.NOT_FOUND, {
          fileName: fileId,
          source: 'google-drive',
        });
        return Response.json(error, { status: 404 });
      }
      const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'fetch_google_drive_file',
        originalError: `HTTP ${metaResponse.status}`,
      });
      return Response.json(systemError, { status: 500 });
    }

    const fileMeta = (await metaResponse.json()) as {
      id: string;
      name: string;
      mimeType: string;
      size?: string;
    };

    if (fileMeta.mimeType !== 'application/pdf') {
      const error = createDomainError(FILE_ERRORS.INVALID_TYPE, {
        expectedType: 'application/pdf',
        receivedType: fileMeta.mimeType,
      });
      return Response.json(error, { status: 400 });
    }

    const maxSize = 50 * 1024 * 1024;
    if (fileMeta.size && parseInt(fileMeta.size, 10) > maxSize) {
      const error = createDomainError(FILE_ERRORS.TOO_LARGE, {
        maxSize: maxSize,
        fileSize: parseInt(fileMeta.size, 10),
      });
      return Response.json(error, { status: 413 });
    }

    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!downloadResponse.ok) {
      const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'download_google_drive_file',
        originalError: `HTTP ${downloadResponse.status}`,
      });
      return Response.json(systemError, { status: 500 });
    }

    const fileContent = await downloadResponse.arrayBuffer();

    const header = new Uint8Array(fileContent.slice(0, PDF_MAGIC_BYTES.length));
    if (!isPdfSignature(header)) {
      const error = createDomainError(FILE_ERRORS.INVALID_TYPE, {
        expectedType: 'application/pdf',
        receivedType: 'unknown (invalid PDF signature)',
        source: 'google-drive',
      });
      return Response.json(error, { status: 400 });
    }

    const project = await db
      .select({ orgId: projects.orgId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_project_for_import',
        projectId,
        message: 'Project not found',
      });
      return Response.json(error, { status: 404 });
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

    return Response.json(
      {
        success: true as const,
        id: mediaFileId,
        file: {
          key: r2Key,
          fileName: uniqueFileName,
          originalFileName: originalFileName !== uniqueFileName ? originalFileName : undefined,
          size: fileSize,
          source: 'google-drive' as const,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Google Drive import error:', error);
    if (isDomainError(error)) {
      return Response.json(error, { status: 400 });
    }
    const err = error as Error;
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'import_google_drive_file',
      originalError: typeof err?.message === 'string' ? err.message : String(error),
    });
    return Response.json(systemError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/google-drive/import')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
