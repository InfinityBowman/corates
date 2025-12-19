/**
 * PDF routes for Hono
 * Handle PDF upload/download via R2 storage
 *
 * PDFs are stored with keys: projects/{projectId}/studies/{studyId}/{filename}
 */

import { Hono } from 'hono';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { createDb } from '../db/client.js';
import { projectMembers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createErrorResponse, ERROR_CODES, FILE_SIZE_LIMITS } from '../config/constants.js';

const pdfRoutes = new Hono();

// Apply auth middleware to all routes
pdfRoutes.use('*', requireAuth);

/**
 * Middleware to verify project membership
 */
async function verifyProjectMembership(c, next) {
  const { user } = getAuth(c);
  const projectId = c.req.param('projectId');
  const studyId = c.req.param('studyId');

  if (!projectId || !studyId) {
    return c.json({ error: 'Missing project or study ID' }, 400);
  }

  // Verify user is a member of this project using Drizzle ORM
  const db = createDb(c.env.DB);
  const membership = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
    .get();

  if (!membership) {
    return c.json({ error: 'Not a member of this project' }, 403);
  }

  c.set('projectId', projectId);
  c.set('studyId', studyId);
  c.set('memberRole', membership.role);

  await next();
}

// Apply membership middleware to all routes
pdfRoutes.use('*', verifyProjectMembership);

function isValidFileName(fileName) {
  if (!fileName) return false;
  if (fileName.length > 200) return false;
  if (/[\\/]/.test(fileName)) return false;
  if (/\p{C}/u.test(fileName)) return false;
  if (fileName.includes('"')) return false;
  return true;
}

/**
 * GET /api/projects/:projectId/studies/:studyId/pdfs
 * List PDFs for a study
 */
pdfRoutes.get('/', async c => {
  const projectId = c.get('projectId');
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
    return c.json(createErrorResponse(ERROR_CODES.DB_ERROR, error.message), 500);
  }
});

/**
 * POST /api/projects/:projectId/studies/:studyId/pdf
 * Upload a PDF for a study
 */
pdfRoutes.post('/', async c => {
  const { user } = getAuth(c);
  const projectId = c.get('projectId');
  const studyId = c.get('studyId');
  const memberRole = c.get('memberRole');

  // Enforce read-only access for viewers
  if (memberRole === 'viewer') {
    return c.json(createErrorResponse(ERROR_CODES.AUTH_FORBIDDEN, 'Insufficient permissions'), 403);
  }

  // Check Content-Length header first for early rejection
  const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);
  if (contentLength > FILE_SIZE_LIMITS.PDF) {
    return c.json(
      createErrorResponse(
        ERROR_CODES.FILE_TOO_LARGE,
        `File size exceeds limit of ${FILE_SIZE_LIMITS.PDF / (1024 * 1024)}MB`,
      ),
      413,
    );
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
        return c.json(createErrorResponse(ERROR_CODES.MISSING_FIELD, 'No file provided'), 400);
      }

      // Check file size
      if (file.size > FILE_SIZE_LIMITS.PDF) {
        return c.json(
          createErrorResponse(
            ERROR_CODES.FILE_TOO_LARGE,
            `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds limit of ${FILE_SIZE_LIMITS.PDF / (1024 * 1024)}MB`,
          ),
          413,
        );
      }

      fileName = file.name || 'document.pdf';
      pdfData = await file.arrayBuffer();
    } else if (contentType === 'application/pdf') {
      // Handle raw PDF upload
      fileName = c.req.header('X-File-Name') || 'document.pdf';
      pdfData = await c.req.arrayBuffer();

      // Check size after reading for raw uploads
      if (pdfData.byteLength > FILE_SIZE_LIMITS.PDF) {
        return c.json(
          createErrorResponse(
            ERROR_CODES.FILE_TOO_LARGE,
            `File size (${(pdfData.byteLength / (1024 * 1024)).toFixed(2)}MB) exceeds limit of ${FILE_SIZE_LIMITS.PDF / (1024 * 1024)}MB`,
          ),
          413,
        );
      }
    } else {
      return c.json(
        createErrorResponse(
          ERROR_CODES.FILE_INVALID_TYPE,
          'Invalid content type. Expected multipart/form-data or application/pdf',
        ),
        400,
      );
    }

    if (!isValidFileName(fileName)) {
      return c.json(
        createErrorResponse(
          ERROR_CODES.MISSING_FIELD,
          'Invalid file name. Avoid quotes, slashes, control characters, and very long names.',
        ),
        400,
      );
    }

    // Validate it's a PDF (check magic bytes)
    const header = new Uint8Array(pdfData.slice(0, 5));
    const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
    const isPdf = pdfMagic.every((byte, i) => header[i] === byte);

    if (!isPdf) {
      return c.json(
        createErrorResponse(ERROR_CODES.FILE_INVALID_TYPE, 'File is not a valid PDF'),
        400,
      );
    }

    // Check if file with same name already exists
    const key = `projects/${projectId}/studies/${studyId}/${fileName}`;
    const existing = await c.env.PDF_BUCKET.head(key);
    if (existing) {
      return c.json(
        createErrorResponse(
          ERROR_CODES.FILE_ALREADY_EXISTS,
          `File "${fileName}" already exists. Rename or remove the existing copy.`,
        ),
        409,
      );
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
    return c.json(createErrorResponse(ERROR_CODES.FILE_UPLOAD_FAILED, error.message), 500);
  }
});

/**
 * GET /api/projects/:projectId/studies/:studyId/pdf/:fileName
 * Download a PDF for a study
 */
pdfRoutes.get('/:fileName', async c => {
  const projectId = c.get('projectId');
  const studyId = c.get('studyId');
  const fileName = decodeURIComponent(c.req.param('fileName'));

  if (!fileName) {
    return c.json(createErrorResponse(ERROR_CODES.MISSING_FIELD, 'Missing file name'), 400);
  }

  if (!isValidFileName(fileName)) {
    return c.json(createErrorResponse(ERROR_CODES.MISSING_FIELD, 'Invalid file name'), 400);
  }

  const key = `projects/${projectId}/studies/${studyId}/${fileName}`;

  try {
    const object = await c.env.PDF_BUCKET.get(key);

    if (!object) {
      return c.json(createErrorResponse(ERROR_CODES.FILE_NOT_FOUND), 404);
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
    return c.json(createErrorResponse(ERROR_CODES.INTERNAL_ERROR, error.message), 500);
  }
});

/**
 * DELETE /api/projects/:projectId/studies/:studyId/pdf/:fileName
 * Delete a PDF for a study
 */
pdfRoutes.delete('/:fileName', async c => {
  const memberRole = c.get('memberRole');

  // Verify user has edit permissions
  if (memberRole === 'viewer') {
    return c.json(createErrorResponse(ERROR_CODES.AUTH_FORBIDDEN, 'Insufficient permissions'), 403);
  }

  const projectId = c.get('projectId');
  const studyId = c.get('studyId');
  const fileName = decodeURIComponent(c.req.param('fileName'));

  if (!fileName) {
    return c.json(createErrorResponse(ERROR_CODES.MISSING_FIELD, 'Missing file name'), 400);
  }

  if (!isValidFileName(fileName)) {
    return c.json(createErrorResponse(ERROR_CODES.MISSING_FIELD, 'Invalid file name'), 400);
  }

  const key = `projects/${projectId}/studies/${studyId}/${fileName}`;

  try {
    await c.env.PDF_BUCKET.delete(key);
    return c.json({ success: true });
  } catch (error) {
    console.error('PDF delete error:', error);
    return c.json(createErrorResponse(ERROR_CODES.INTERNAL_ERROR, error.message), 500);
  }
});

export { pdfRoutes };
