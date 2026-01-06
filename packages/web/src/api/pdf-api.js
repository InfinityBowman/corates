/**
 * PDF API - Upload, download, and manage PDFs via R2 storage
 *
 * All endpoints use org-scoped routes: /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs
 */

import { API_BASE } from '@config/api.js';
import { apiFetch } from '@/lib/apiFetch.js';

/**
 * Fetch a PDF from an external URL via the backend proxy (avoids CORS issues)
 * @param {string} url - The external PDF URL (e.g., from Unpaywall)
 * @returns {Promise<ArrayBuffer>} - The PDF data as ArrayBuffer
 */
export async function fetchPdfViaProxy(url) {
  const response = await apiFetch('/api/pdf-proxy', {
    method: 'POST',
    body: { url },
    raw: true,
  });

  return response.arrayBuffer();
}

/**
 * Build the org-scoped PDF base path
 * @param {string} orgId - The organization ID
 * @param {string} projectId - The project ID
 * @param {string} studyId - The study ID
 * @returns {string} The base path for PDF operations (without API_BASE)
 */
function buildPdfBasePath(orgId, projectId, studyId) {
  return `/api/orgs/${orgId}/projects/${projectId}/studies/${studyId}/pdfs`;
}

/**
 * Upload a PDF file for a study
 * @param {string} orgId - The organization ID
 * @param {string} projectId - The project ID
 * @param {string} studyId - The study ID
 * @param {File|ArrayBuffer} file - The PDF file or ArrayBuffer
 * @param {string} [fileName] - Optional filename (required if file is ArrayBuffer)
 * @returns {Promise<{success: boolean, key: string, fileName: string, size: number}>}
 */
export async function uploadPdf(orgId, projectId, studyId, file, fileName = null) {
  const path = buildPdfBasePath(orgId, projectId, studyId);

  // Always use FormData for consistency and better browser streaming support
  const formData = new FormData();

  if (file instanceof File) {
    formData.append('file', file);
  } else {
    // Convert ArrayBuffer to Blob so we can use FormData
    const blob = new Blob([file], { type: 'application/pdf' });
    const fileObj = new File([blob], fileName || 'document.pdf', { type: 'application/pdf' });
    formData.append('file', fileObj);
  }

  return apiFetch(path, {
    method: 'POST',
    body: formData,
  });
}

/**
 * Download a PDF file from a study
 * @param {string} orgId - The organization ID
 * @param {string} projectId - The project ID
 * @param {string} studyId - The study ID
 * @param {string} fileName - The PDF filename
 * @returns {Promise<ArrayBuffer>}
 */
export async function downloadPdf(orgId, projectId, studyId, fileName) {
  const basePath = buildPdfBasePath(orgId, projectId, studyId);
  const path = `${basePath}/${encodeURIComponent(fileName)}`;

  const response = await apiFetch(path, {
    method: 'GET',
    raw: true,
  });

  return response.arrayBuffer();
}

/**
 * Get the URL for a PDF (for direct embedding/viewing)
 * @param {string} orgId - The organization ID
 * @param {string} projectId - The project ID
 * @param {string} studyId - The study ID
 * @param {string} fileName - The PDF filename
 * @returns {string}
 */
export function getPdfUrl(orgId, projectId, studyId, fileName) {
  const basePath = buildPdfBasePath(orgId, projectId, studyId);
  // Need full URL for embedding in iframes/viewers
  return `${API_BASE}${basePath}/${encodeURIComponent(fileName)}`;
}

/**
 * Delete a PDF from a study
 * @param {string} orgId - The organization ID
 * @param {string} projectId - The project ID
 * @param {string} studyId - The study ID
 * @param {string} fileName - The PDF filename
 * @returns {Promise<{success: boolean}>}
 */
export async function deletePdf(orgId, projectId, studyId, fileName) {
  const basePath = buildPdfBasePath(orgId, projectId, studyId);
  const path = `${basePath}/${encodeURIComponent(fileName)}`;

  return apiFetch.delete(path);
}

/**
 * List all PDFs for a study
 * @param {string} orgId - The organization ID
 * @param {string} projectId - The project ID
 * @param {string} studyId - The study ID
 * @returns {Promise<{pdfs: Array<{key: string, fileName: string, size: number, uploaded: string}>}>}
 */
export async function listPdfs(orgId, projectId, studyId) {
  const path = buildPdfBasePath(orgId, projectId, studyId);

  return apiFetch.get(path);
}
