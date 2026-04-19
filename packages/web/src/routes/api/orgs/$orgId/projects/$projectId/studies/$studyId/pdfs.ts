import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { mediaFiles, user } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  createDomainError,
  FILE_ERRORS,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
  PDF_LIMITS,
  PDF_MAGIC_BYTES,
  isValidPdfFilename,
  isPdfSignature,
  formatFileSize,
} from '@corates/shared';
import type { OrgId, ProjectId, StudyId } from '@corates/shared/ids';
import { generateUniqueFileName } from '@corates/workers/media-files';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';
import { authMiddleware } from '@/server/middleware/auth';

type HandlerArgs = {
  request: Request;
  params: { orgId: OrgId; projectId: ProjectId; studyId: StudyId };
  context: { db: Database };
};

export const handleGet = async ({ request, params, context: { db } }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, db, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(request, env, db, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  try {
    const results = await db
      .select({
        id: mediaFiles.id,
        filename: mediaFiles.filename,
        originalName: mediaFiles.originalName,
        fileType: mediaFiles.fileType,
        fileSize: mediaFiles.fileSize,
        bucketKey: mediaFiles.bucketKey,
        createdAt: mediaFiles.createdAt,
        uploadedBy: mediaFiles.uploadedBy,
        uploadedByName: user.name,
        uploadedByEmail: user.email,
        uploadedByGivenName: user.givenName,
      })
      .from(mediaFiles)
      .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
      .where(
        and(eq(mediaFiles.projectId, params.projectId), eq(mediaFiles.studyId, params.studyId)),
      )
      .orderBy(mediaFiles.createdAt);

    const pdfs = results.map(row => ({
      id: row.id,
      key: row.bucketKey,
      fileName: row.filename,
      originalName: row.originalName,
      size: row.fileSize,
      fileType: row.fileType,
      createdAt: row.createdAt,
      uploadedBy:
        row.uploadedBy ?
          {
            id: row.uploadedBy,
            name: row.uploadedByName,
            email: row.uploadedByEmail,
            givenName: row.uploadedByGivenName,
          }
        : null,
    }));

    return Response.json({ pdfs }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('PDF list error:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'list_pdfs',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handlePost = async ({ request, params, context: { db } }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, db, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, db, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  const access = await requireProjectAccess(request, env, db, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLength > PDF_LIMITS.MAX_SIZE) {
    return Response.json(
      createDomainError(
        FILE_ERRORS.TOO_LARGE,
        { fileSize: contentLength, maxSize: PDF_LIMITS.MAX_SIZE },
        `File size exceeds limit of ${formatFileSize(PDF_LIMITS.MAX_SIZE)}`,
      ),
      { status: 413 },
    );
  }

  const contentType = request.headers.get('Content-Type') || '';

  let pdfData: ArrayBuffer;
  let fileName: string;

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return Response.json(
          createDomainError(
            VALIDATION_ERRORS.FIELD_REQUIRED,
            { field: 'file' },
            'No file provided',
          ),
          { status: 400 },
        );
      }

      if (file.size > PDF_LIMITS.MAX_SIZE) {
        return Response.json(
          createDomainError(
            FILE_ERRORS.TOO_LARGE,
            { fileSize: file.size, maxSize: PDF_LIMITS.MAX_SIZE },
            `File size (${formatFileSize(file.size)}) exceeds limit of ${formatFileSize(PDF_LIMITS.MAX_SIZE)}`,
          ),
          { status: 413 },
        );
      }

      fileName = file.name || 'document.pdf';
      pdfData = await file.arrayBuffer();
    } else if (contentType === 'application/pdf') {
      fileName = request.headers.get('X-File-Name') || 'document.pdf';
      pdfData = await request.arrayBuffer();

      if (pdfData.byteLength > PDF_LIMITS.MAX_SIZE) {
        return Response.json(
          createDomainError(
            FILE_ERRORS.TOO_LARGE,
            { fileSize: pdfData.byteLength, maxSize: PDF_LIMITS.MAX_SIZE },
            `File size (${formatFileSize(pdfData.byteLength)}) exceeds limit of ${formatFileSize(PDF_LIMITS.MAX_SIZE)}`,
          ),
          { status: 413 },
        );
      }
    } else {
      return Response.json(
        createDomainError(
          FILE_ERRORS.INVALID_TYPE,
          { contentType },
          'Invalid content type. Expected multipart/form-data or application/pdf',
        ),
        { status: 400 },
      );
    }

    if (!isValidPdfFilename(fileName)) {
      return Response.json(
        createDomainError(
          VALIDATION_ERRORS.FIELD_INVALID_FORMAT,
          { field: 'fileName', value: fileName },
          'Invalid file name. Avoid quotes, slashes, control characters, and very long names.',
        ),
        { status: 400 },
      );
    }

    const header = new Uint8Array(pdfData.slice(0, PDF_MAGIC_BYTES.length));
    if (!isPdfSignature(header)) {
      return Response.json(
        createDomainError(
          FILE_ERRORS.INVALID_TYPE,
          { fileType: 'unknown', expectedType: 'application/pdf' },
          'File is not a valid PDF',
        ),
        { status: 400 },
      );
    }

    const originalFileName = fileName;

    const uniqueFileName = await generateUniqueFileName(
      fileName,
      params.projectId,
      params.studyId,
      db,
    );
    const key = `projects/${params.projectId}/studies/${params.studyId}/${uniqueFileName}`;

    await env.PDF_BUCKET.put(key, pdfData, {
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata: {
        projectId: params.projectId,
        studyId: params.studyId,
        fileName: uniqueFileName,
        originalFileName: originalFileName !== uniqueFileName ? originalFileName : '',
        uploadedBy: access.context.userId,
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
        fileSize: pdfData.byteLength,
        uploadedBy: access.context.userId,
        bucketKey: key,
        orgId: params.orgId,
        projectId: params.projectId,
        studyId: params.studyId,
        createdAt: new Date(),
      });
    } catch (dbErr) {
      const dbError = dbErr as Error;
      console.error('Failed to insert mediaFiles record after R2 upload:', dbError);
      try {
        await env.PDF_BUCKET.delete(key);
      } catch (cleanupError) {
        console.error('Failed to cleanup R2 object after DB insert failure:', cleanupError);
      }
      return Response.json(
        createDomainError(
          FILE_ERRORS.UPLOAD_FAILED,
          { operation: 'upload_pdf_db_insert', originalError: dbError.message },
          'Failed to save file metadata',
        ),
        { status: 500 },
      );
    }

    return Response.json(
      {
        success: true,
        id: mediaFileId,
        key,
        fileName: uniqueFileName,
        originalFileName: originalFileName !== uniqueFileName ? originalFileName : undefined,
        size: pdfData.byteLength,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('PDF upload error:', error);
    return Response.json(
      createDomainError(
        FILE_ERRORS.UPLOAD_FAILED,
        { operation: 'upload_pdf', originalError: error.message },
        error.message,
      ),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/orgs/$orgId/projects/$projectId/studies/$studyId/pdfs')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
});
