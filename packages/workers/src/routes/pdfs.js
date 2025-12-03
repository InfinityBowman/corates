/**
 * PDF routes for Hono
 * Handle PDF upload/download via R2 storage
 *
 * PDFs are stored with keys: projects/{projectId}/studies/{studyId}/{filename}
 */

import { Hono } from 'hono';
import { requireAuth, getAuth } from '../middleware/auth.js';

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

  // Verify user is a member of this project
  const membership = await c.env.DB.prepare(
    'SELECT role FROM project_members WHERE projectId = ? AND userId = ?',
  )
    .bind(projectId, user.id)
    .first();

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
    return c.json({ error: 'Failed to list PDFs' }, 500);
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

  const contentType = c.req.header('Content-Type') || '';

  let pdfData;
  let fileName;

  try {
    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data
      const formData = await c.req.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return c.json({ error: 'No file provided' }, 400);
      }

      fileName = file.name || 'document.pdf';
      pdfData = await file.arrayBuffer();
    } else if (contentType === 'application/pdf') {
      // Handle raw PDF upload
      fileName = c.req.header('X-File-Name') || 'document.pdf';
      pdfData = await c.req.arrayBuffer();
    } else {
      return c.json({ error: 'Invalid content type' }, 400);
    }

    // Validate it's a PDF (check magic bytes)
    const header = new Uint8Array(pdfData.slice(0, 5));
    const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
    const isPdf = pdfMagic.every((byte, i) => header[i] === byte);

    if (!isPdf) {
      return c.json({ error: 'File is not a valid PDF' }, 400);
    }

    // Store in R2
    const key = `projects/${projectId}/studies/${studyId}/${fileName}`;

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
    return c.json({ error: 'Failed to upload PDF' }, 500);
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
    return c.json({ error: 'Missing file name' }, 400);
  }

  const key = `projects/${projectId}/studies/${studyId}/${fileName}`;

  try {
    const object = await c.env.PDF_BUCKET.get(key);

    if (!object) {
      return c.json({ error: 'PDF not found' }, 404);
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('PDF download error:', error);
    return c.json({ error: 'Failed to download PDF' }, 500);
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
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  const projectId = c.get('projectId');
  const studyId = c.get('studyId');
  const fileName = decodeURIComponent(c.req.param('fileName'));

  if (!fileName) {
    return c.json({ error: 'Missing file name' }, 400);
  }

  const key = `projects/${projectId}/studies/${studyId}/${fileName}`;

  try {
    await c.env.PDF_BUCKET.delete(key);
    return c.json({ success: true });
  } catch (error) {
    console.error('PDF delete error:', error);
    return c.json({ error: 'Failed to delete PDF' }, 500);
  }
});

export { pdfRoutes };
