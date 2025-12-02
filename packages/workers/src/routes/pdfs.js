/**
 * PDF Routes - Handle PDF upload/download via R2 storage
 *
 * PDFs are stored with keys: projects/{projectId}/studies/{studyId}/{filename}
 */

import { verifyAuth } from '../auth/config.js';

/**
 * Upload a PDF for a study
 * POST /api/projects/:projectId/studies/:studyId/pdf
 */
export async function uploadPdf(request, env) {
  const { user } = await verifyAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  // Expected: /api/projects/{projectId}/studies/{studyId}/pdf
  const projectIdIndex = pathParts.indexOf('projects') + 1;
  const studyIdIndex = pathParts.indexOf('studies') + 1;
  const projectId = pathParts[projectIdIndex];
  const studyId = pathParts[studyIdIndex];

  if (!projectId || !studyId) {
    return new Response(JSON.stringify({ error: 'Missing project or study ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify user is a member of this project
  const membership = await env.DB.prepare(
    'SELECT role FROM project_members WHERE projectId = ? AND userId = ?',
  )
    .bind(projectId, user.id)
    .first();

  if (!membership) {
    return new Response(JSON.stringify({ error: 'Not a member of this project' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get the file from the request
  const contentType = request.headers.get('Content-Type') || '';

  let pdfData;
  let fileName;

  if (contentType.includes('multipart/form-data')) {
    // Handle multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    fileName = file.name || 'document.pdf';
    pdfData = await file.arrayBuffer();
  } else if (contentType === 'application/pdf') {
    // Handle raw PDF upload
    fileName = request.headers.get('X-File-Name') || 'document.pdf';
    pdfData = await request.arrayBuffer();
  } else {
    return new Response(JSON.stringify({ error: 'Invalid content type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate it's a PDF (check magic bytes)
  const header = new Uint8Array(pdfData.slice(0, 5));
  const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  const isPdf = pdfMagic.every((byte, i) => header[i] === byte);

  if (!isPdf) {
    return new Response(JSON.stringify({ error: 'File is not a valid PDF' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Store in R2
  const key = `projects/${projectId}/studies/${studyId}/${fileName}`;

  try {
    await env.PDF_BUCKET.put(key, pdfData, {
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

    // Return success - the client will update Y.js with PDF metadata
    // This simplifies the architecture by avoiding server-side Y.js sync for PDFs
    return new Response(
      JSON.stringify({
        success: true,
        key,
        fileName,
        size: pdfData.byteLength,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('PDF upload error:', error);
    return new Response(JSON.stringify({ error: 'Failed to upload PDF' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Download a PDF for a study
 * GET /api/projects/:projectId/studies/:studyId/pdf/:fileName
 */
export async function downloadPdf(request, env) {
  const { user } = await verifyAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  // Expected: /api/projects/{projectId}/studies/{studyId}/pdf/{fileName}
  const projectIdIndex = pathParts.indexOf('projects') + 1;
  const studyIdIndex = pathParts.indexOf('studies') + 1;
  const pdfIndex = pathParts.indexOf('pdf') + 1;
  const projectId = pathParts[projectIdIndex];
  const studyId = pathParts[studyIdIndex];
  const fileName = decodeURIComponent(pathParts[pdfIndex]);

  if (!projectId || !studyId || !fileName) {
    return new Response(JSON.stringify({ error: 'Missing project, study, or file name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify user is a member of this project
  const membership = await env.DB.prepare(
    'SELECT role FROM project_members WHERE projectId = ? AND userId = ?',
  )
    .bind(projectId, user.id)
    .first();

  if (!membership) {
    return new Response(JSON.stringify({ error: 'Not a member of this project' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get from R2
  const key = `projects/${projectId}/studies/${studyId}/${fileName}`;

  try {
    const object = await env.PDF_BUCKET.get(key);

    if (!object) {
      return new Response(JSON.stringify({ error: 'PDF not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
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
    return new Response(JSON.stringify({ error: 'Failed to download PDF' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Delete a PDF for a study
 * DELETE /api/projects/:projectId/studies/:studyId/pdf/:fileName
 */
export async function deletePdf(request, env) {
  const { user } = await verifyAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const projectIdIndex = pathParts.indexOf('projects') + 1;
  const studyIdIndex = pathParts.indexOf('studies') + 1;
  const pdfIndex = pathParts.indexOf('pdf') + 1;
  const projectId = pathParts[projectIdIndex];
  const studyId = pathParts[studyIdIndex];
  const fileName = decodeURIComponent(pathParts[pdfIndex]);

  if (!projectId || !studyId || !fileName) {
    return new Response(JSON.stringify({ error: 'Missing project, study, or file name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify user is a member of this project with edit permissions
  const membership = await env.DB.prepare(
    'SELECT role FROM project_members WHERE projectId = ? AND userId = ?',
  )
    .bind(projectId, user.id)
    .first();

  if (!membership || membership.role === 'viewer') {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Delete from R2
  const key = `projects/${projectId}/studies/${studyId}/${fileName}`;

  try {
    await env.PDF_BUCKET.delete(key);

    // Return success - the client will update Y.js to remove PDF metadata
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('PDF delete error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete PDF' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * List PDFs for a study
 * GET /api/projects/:projectId/studies/:studyId/pdfs
 */
export async function listPdfs(request, env) {
  const { user } = await verifyAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const projectIdIndex = pathParts.indexOf('projects') + 1;
  const studyIdIndex = pathParts.indexOf('studies') + 1;
  const projectId = pathParts[projectIdIndex];
  const studyId = pathParts[studyIdIndex];

  if (!projectId || !studyId) {
    return new Response(JSON.stringify({ error: 'Missing project or study ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify user is a member of this project
  const membership = await env.DB.prepare(
    'SELECT role FROM project_members WHERE projectId = ? AND userId = ?',
  )
    .bind(projectId, user.id)
    .first();

  if (!membership) {
    return new Response(JSON.stringify({ error: 'Not a member of this project' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // List from R2
  const prefix = `projects/${projectId}/studies/${studyId}/`;

  try {
    const listed = await env.PDF_BUCKET.list({ prefix });

    const pdfs = listed.objects.map(obj => ({
      key: obj.key,
      fileName: obj.key.replace(prefix, ''),
      size: obj.size,
      uploaded: obj.uploaded,
    }));

    return new Response(JSON.stringify({ pdfs }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('PDF list error:', error);
    return new Response(JSON.stringify({ error: 'Failed to list PDFs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
