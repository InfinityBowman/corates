/**
 * Org-scoped PDF routes for Hono
 * Routes: /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs
 *
 * PDFs are stored with keys: projects/{projectId}/studies/{studyId}/{filename}
 */

import { Hono } from 'hono';
import { requireAuth, getAuth } from '../../middleware/auth.js';
import {
  requireOrgMembership,
  requireProjectAccess,
  getProjectContext,
} from '../../middleware/requireOrg.js';
import { FILE_SIZE_LIMITS } from '../../config/constants.js';
import {
  createDomainError,
  FILE_ERRORS,
  VALIDATION_ERRORS,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';

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
  if (!fileName) return false;
  if (fileName.length > 200) return false;
  if (/[\\/]/.test(fileName)) return false;
  if (/\p{C}/u.test(fileName)) return false;
  if (fileName.includes('"')) return false;
  return true;
}

/**
 * GET /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs
 * List PDFs for a study
 */
orgPdfRoutes.get('/', requireOrgMembership(), requireProjectAccess(), extractStudyId, async c => {
  const { projectId } = getProjectContext(c);
  const studyId = c.get('studyId');

  const prefix = `projects/${projectId}/studies/${studyId}/`;

  try {
    const listed = await c.env.PDF_BUCKET.list({ prefix });

    const pdfs = listed.objects.map(obj => ({
      key: obj.key,
      fileName: obj.key.replace(prefix, ''),
      size: obj.size,
      uploaded: obj.uploaded,
    }));

    return c.json({ pdfs });
  } catch (error) {
    console.error('PDF list error:', error);
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'list_pdfs',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

/**
 * POST /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs
 * Upload a PDF for a study
 */
orgPdfRoutes.post('/', requireOrgMembership(), requireProjectAccess(), extractStudyId, async c => {
  const { user } = getAuth(c);
  const { projectId, projectRole } = getProjectContext(c);
  const studyId = c.get('studyId');

  // Enforce read-only access for viewers
  if (projectRole === 'viewer') {
    const error = createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'upload_pdf' },
      'Insufficient permissions',
    );
    return c.json(error, error.statusCode);
  }

  // Check Content-Length header first for early rejection
  const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);
  if (contentLength > FILE_SIZE_LIMITS.PDF) {
    const error = createDomainError(
      FILE_ERRORS.TOO_LARGE,
      { fileSize: contentLength, maxSize: FILE_SIZE_LIMITS.PDF },
      `File size exceeds limit of ${FILE_SIZE_LIMITS.PDF / (1024 * 1024)}MB`,
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
      if (file.size > FILE_SIZE_LIMITS.PDF) {
        const error = createDomainError(
          FILE_ERRORS.TOO_LARGE,
          { fileSize: file.size, maxSize: FILE_SIZE_LIMITS.PDF },
          `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds limit of ${FILE_SIZE_LIMITS.PDF / (1024 * 1024)}MB`,
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
      if (pdfData.byteLength > FILE_SIZE_LIMITS.PDF) {
        const error = createDomainError(
          FILE_ERRORS.TOO_LARGE,
          { fileSize: pdfData.byteLength, maxSize: FILE_SIZE_LIMITS.PDF },
          `File size (${(pdfData.byteLength / (1024 * 1024)).toFixed(2)}MB) exceeds limit of ${FILE_SIZE_LIMITS.PDF / (1024 * 1024)}MB`,
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
    const header = new Uint8Array(pdfData.slice(0, 5));
    const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
    const isPdf = pdfMagic.every((byte, i) => header[i] === byte);

    if (!isPdf) {
      const error = createDomainError(
        FILE_ERRORS.INVALID_TYPE,
        { fileType: 'unknown', expectedType: 'application/pdf' },
        'File is not a valid PDF',
      );
      return c.json(error, error.statusCode);
    }

    // Check for duplicate file name
    const key = `projects/${projectId}/studies/${studyId}/${fileName}`;
    const existingFile = await c.env.PDF_BUCKET.head(key);
    if (existingFile) {
      const error = createDomainError(FILE_ERRORS.ALREADY_EXISTS, {
        fileName,
        key,
      });
      return c.json(error, error.statusCode);
    }

    // Store in R2
    await c.env.PDF_BUCKET.put(key, pdfData, {
      httpMetadata: {
        contentType: 'application/pdf',
      },
      customMetadata: {
        projectId,
        studyId,
        fileName,
        uploadedBy: user.id,
        uploadedAt: new Date().toISOString(),
      },
    });

    return c.json({
      success: true,
      key,
      fileName,
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
});

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
  requireProjectAccess(),
  extractStudyId,
  async c => {
    const { projectId, projectRole } = getProjectContext(c);
    const studyId = c.get('studyId');

    // Verify user has edit permissions
    if (projectRole === 'viewer') {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'delete_pdf' },
        'Insufficient permissions',
      );
      return c.json(error, error.statusCode);
    }

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
      await c.env.PDF_BUCKET.delete(key);
      return c.json({ success: true });
    } catch (error) {
      console.error('PDF delete error:', error);
      const internalError = createDomainError(
        SYSTEM_ERRORS.INTERNAL_ERROR,
        { operation: 'delete_pdf', originalError: error.message },
        error.message,
      );
      return c.json(internalError, internalError.statusCode);
    }
  },
);

export { orgPdfRoutes };
