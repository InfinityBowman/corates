/**
 * Org-scoped PDF routes for Hono
 * Routes: /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs
 *
 * PDFs are stored with keys: projects/{projectId}/studies/{studyId}/{filename}
 */

import { Hono } from 'hono';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import {
  requireOrgMembership,
  requireProjectAccess,
  getProjectContext,
} from '@/middleware/requireOrg.js';
import { requireOrgWriteAccess } from '@/middleware/requireOrgWriteAccess.js';
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
import { createDb } from '@/db/client.js';
import { mediaFiles, user } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';

const orgPdfRoutes = new Hono();

// Apply auth and org/project membership middleware to all routes
orgPdfRoutes.use('*', requireAuth);

/**
 * Middleware to extract studyId from params
 */
async function extractStudyId(c, next) {
  const studyId = c.req.param('studyId');

  if (!studyId) {
    const error = createDomainError(VALIDATION_ERRORS.FIELD_REQUIRED, {
      field: 'studyId',
    });
    return c.json(error, error.statusCode);
  }

  c.set('studyId', studyId);
  await next();
}

function isValidFileName(fileName) {
  return isValidPdfFilename(fileName);
}

/**
 * Generate a unique filename by auto-renaming if duplicate exists
 * @param {string} fileName - Original filename
 * @param {string} projectId - Project ID
 * @param {string} studyId - Study ID
 * @param {DrizzleD1Database} db - Database connection
 * @returns {Promise<string>} Unique filename
 */
export async function generateUniqueFileName(fileName, projectId, studyId, db) {
  // Check if original filename is available
  const existing = await db
    .select({ id: mediaFiles.id })
    .from(mediaFiles)
    .where(
      and(
        eq(mediaFiles.projectId, projectId),
        eq(mediaFiles.studyId, studyId),
        eq(mediaFiles.filename, fileName),
      ),
    )
    .get();

  if (!existing) {
    return fileName;
  }

  // Extract name and extension
  const lastDot = fileName.lastIndexOf('.');
  const nameWithoutExt = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot > 0 ? fileName.slice(lastDot) : '';

  // Try numbered versions: "file (1).pdf", "file (2).pdf", etc.
  let counter = 1;
  let uniqueFileName;
  let found = true;

  while (found && counter < 1000) {
    uniqueFileName = `${nameWithoutExt} (${counter})${ext}`;
    const duplicate = await db
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.projectId, projectId),
          eq(mediaFiles.studyId, studyId),
          eq(mediaFiles.filename, uniqueFileName),
        ),
      )
      .get();

    if (!duplicate) {
      found = false;
    } else {
      counter++;
    }
  }

  if (found) {
    // Fallback: use timestamp if we hit the limit
    const timestamp = Date.now();
    uniqueFileName = `${nameWithoutExt}_${timestamp}${ext}`;
  }

  return uniqueFileName;
}

/**
 * GET /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs
 * List PDFs for a study
 */
orgPdfRoutes.get('/', requireOrgMembership(), requireProjectAccess(), extractStudyId, async c => {
  const { projectId } = getProjectContext(c);
  const studyId = c.get('studyId');

  try {
    const db = createDb(c.env.DB);

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
        uploadedByDisplayName: user.displayName,
      })
      .from(mediaFiles)
      .leftJoin(user, eq(mediaFiles.uploadedBy, user.id))
      .where(and(eq(mediaFiles.projectId, projectId), eq(mediaFiles.studyId, studyId)))
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
            displayName: row.uploadedByDisplayName,
          }
        : null,
    }));

    return c.json({ pdfs });
  } catch (error) {
    console.error('PDF list error:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_pdfs',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs
 * Upload a PDF for a study
 */
orgPdfRoutes.post(
  '/',
  requireOrgMembership(),
  requireOrgWriteAccess(),
  requireProjectAccess(),
  extractStudyId,
  async c => {
    const { user } = getAuth(c);
    const { projectId } = getProjectContext(c);
    const studyId = c.get('studyId');

    // Check Content-Length header first for early rejection
    const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);
    if (contentLength > PDF_LIMITS.MAX_SIZE) {
      const error = createDomainError(
        FILE_ERRORS.TOO_LARGE,
        { fileSize: contentLength, maxSize: PDF_LIMITS.MAX_SIZE },
        `File size exceeds limit of ${formatFileSize(PDF_LIMITS.MAX_SIZE)}`,
      );
      return c.json(error, error.statusCode);
    }

    const contentType = c.req.header('Content-Type') || '';

    let pdfData;
    let fileName;

    try {
      if (contentType.includes('multipart/form-data')) {
        // Handle multipart form data
        const formData = await c.req.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
          const error = createDomainError(
            VALIDATION_ERRORS.FIELD_REQUIRED,
            { field: 'file' },
            'No file provided',
          );
          return c.json(error, error.statusCode);
        }

        // Check file size
        if (file.size > PDF_LIMITS.MAX_SIZE) {
          const error = createDomainError(
            FILE_ERRORS.TOO_LARGE,
            { fileSize: file.size, maxSize: PDF_LIMITS.MAX_SIZE },
            `File size (${formatFileSize(file.size)}) exceeds limit of ${formatFileSize(PDF_LIMITS.MAX_SIZE)}`,
          );
          return c.json(error, error.statusCode);
        }

        fileName = file.name || 'document.pdf';
        pdfData = await file.arrayBuffer();
      } else if (contentType === 'application/pdf') {
        // Handle raw PDF upload
        fileName = c.req.header('X-File-Name') || 'document.pdf';
        pdfData = await c.req.arrayBuffer();

        // Check size after reading for raw uploads
        if (pdfData.byteLength > PDF_LIMITS.MAX_SIZE) {
          const error = createDomainError(
            FILE_ERRORS.TOO_LARGE,
            { fileSize: pdfData.byteLength, maxSize: PDF_LIMITS.MAX_SIZE },
            `File size (${formatFileSize(pdfData.byteLength)}) exceeds limit of ${formatFileSize(PDF_LIMITS.MAX_SIZE)}`,
          );
          return c.json(error, error.statusCode);
        }
      } else {
        const error = createDomainError(
          FILE_ERRORS.INVALID_TYPE,
          { contentType },
          'Invalid content type. Expected multipart/form-data or application/pdf',
        );
        return c.json(error, error.statusCode);
      }

      if (!isValidFileName(fileName)) {
        const error = createDomainError(
          VALIDATION_ERRORS.FIELD_INVALID_FORMAT,
          { field: 'fileName', value: fileName },
          'Invalid file name. Avoid quotes, slashes, control characters, and very long names.',
        );
        return c.json(error, error.statusCode);
      }

      // Validate it's a PDF (check magic bytes)
      const header = new Uint8Array(pdfData.slice(0, PDF_MAGIC_BYTES.length));
      if (!isPdfSignature(header)) {
        const error = createDomainError(
          FILE_ERRORS.INVALID_TYPE,
          { fileType: 'unknown', expectedType: 'application/pdf' },
          'File is not a valid PDF',
        );
        return c.json(error, error.statusCode);
      }

      const orgId = c.get('orgId');
      const originalFileName = fileName;
      const db = createDb(c.env.DB);

      // Generate unique filename (auto-rename if duplicate exists)
      const uniqueFileName = await generateUniqueFileName(fileName, projectId, studyId, db);
      const key = `projects/${projectId}/studies/${studyId}/${uniqueFileName}`;

      // Store in R2
      await c.env.PDF_BUCKET.put(key, pdfData, {
        httpMetadata: {
          contentType: 'application/pdf',
        },
        customMetadata: {
          projectId,
          studyId,
          fileName: uniqueFileName,
          originalFileName: originalFileName !== uniqueFileName ? originalFileName : undefined,
          uploadedBy: user.id,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Insert into mediaFiles table
      const mediaFileId = crypto.randomUUID();
      try {
        await db.insert(mediaFiles).values({
          id: mediaFileId,
          filename: uniqueFileName,
          originalName: originalFileName,
          fileType: 'application/pdf',
          fileSize: pdfData.byteLength,
          uploadedBy: user.id,
          bucketKey: key,
          orgId,
          projectId,
          studyId,
          createdAt: new Date(),
        });
      } catch (dbError) {
        // Log error but don't fail the request (R2 object exists, can be cleaned up later)
        console.error('Failed to insert mediaFiles record after R2 upload:', dbError);
      }

      return c.json({
        success: true,
        id: mediaFileId,
        key,
        fileName: uniqueFileName,
        originalFileName: originalFileName !== uniqueFileName ? originalFileName : undefined,
        size: pdfData.byteLength,
      });
    } catch (error) {
      console.error('PDF upload error:', error);
      const uploadError = createDomainError(
        FILE_ERRORS.UPLOAD_FAILED,
        { operation: 'upload_pdf', originalError: error.message },
        error.message,
      );
      return c.json(uploadError, uploadError.statusCode);
    }
  },
);

/**
 * GET /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:fileName
 * Download a PDF for a study
 */
orgPdfRoutes.get(
  '/:fileName',
  requireOrgMembership(),
  requireProjectAccess(),
  extractStudyId,
  async c => {
    const { projectId } = getProjectContext(c);
    const studyId = c.get('studyId');
    const fileName = decodeURIComponent(c.req.param('fileName'));

    if (!fileName) {
      const error = createDomainError(
        VALIDATION_ERRORS.FIELD_REQUIRED,
        { field: 'fileName' },
        'Missing file name',
      );
      return c.json(error, error.statusCode);
    }

    if (!isValidFileName(fileName)) {
      const error = createDomainError(
        VALIDATION_ERRORS.FIELD_INVALID_FORMAT,
        { field: 'fileName', value: fileName },
        'Invalid file name',
      );
      return c.json(error, error.statusCode);
    }

    const key = `projects/${projectId}/studies/${studyId}/${fileName}`;

    try {
      const object = await c.env.PDF_BUCKET.get(key);

      if (!object) {
        const error = createDomainError(FILE_ERRORS.NOT_FOUND, { fileName, key });
        return c.json(error, error.statusCode);
      }

      return new Response(object.body, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
            fileName,
          )}`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch (error) {
      console.error('PDF download error:', error);
      const internalError = createDomainError(
        SYSTEM_ERRORS.INTERNAL_ERROR,
        { operation: 'download_pdf', originalError: error.message },
        error.message,
      );
      return c.json(internalError, internalError.statusCode);
    }
  },
);

/**
 * DELETE /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:fileName
 * Delete a PDF for a study
 */
orgPdfRoutes.delete(
  '/:fileName',
  requireOrgMembership(),
  requireOrgWriteAccess(),
  requireProjectAccess(),
  extractStudyId,
  async c => {
    const { projectId } = getProjectContext(c);
    const studyId = c.get('studyId');
    const fileName = decodeURIComponent(c.req.param('fileName'));

    if (!fileName) {
      const error = createDomainError(
        VALIDATION_ERRORS.FIELD_REQUIRED,
        { field: 'fileName' },
        'Missing file name',
      );
      return c.json(error, error.statusCode);
    }

    if (!isValidFileName(fileName)) {
      const error = createDomainError(
        VALIDATION_ERRORS.FIELD_INVALID_FORMAT,
        { field: 'fileName', value: fileName },
        'Invalid file name',
      );
      return c.json(error, error.statusCode);
    }

    const key = `projects/${projectId}/studies/${studyId}/${fileName}`;

    try {
      const db = createDb(c.env.DB);

      // Check if record exists in database first
      const existingRecord = await db
        .select({ id: mediaFiles.id })
        .from(mediaFiles)
        .where(
          and(
            eq(mediaFiles.projectId, projectId),
            eq(mediaFiles.studyId, studyId),
            eq(mediaFiles.filename, fileName),
          ),
        )
        .get();

      if (!existingRecord) {
        // Record doesn't exist in database, but try to delete from R2 anyway
        try {
          await c.env.PDF_BUCKET.delete(key);
        } catch (r2Error) {
          // R2 delete failed, but that's okay - return success since DB record doesn't exist
          console.warn('PDF not found in database, R2 delete also failed:', r2Error);
        }
        return c.json({ success: true });
      }

      // Delete from mediaFiles table (database is source of truth)
      await db
        .delete(mediaFiles)
        .where(
          and(
            eq(mediaFiles.projectId, projectId),
            eq(mediaFiles.studyId, studyId),
            eq(mediaFiles.filename, fileName),
          ),
        );

      // Delete from R2 (if this fails, log but don't fail - database is source of truth)
      try {
        await c.env.PDF_BUCKET.delete(key);
      } catch (r2Error) {
        console.error('Failed to delete PDF from R2 after database delete:', r2Error);
        // Continue - database is source of truth
      }

      return c.json({ success: true });
    } catch (error) {
      console.error('PDF delete error:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'delete_pdf',
        originalError: error.message,
      });
      return c.json(dbError, dbError.statusCode);
    }
  },
);

export { orgPdfRoutes };
