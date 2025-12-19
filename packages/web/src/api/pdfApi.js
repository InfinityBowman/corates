/**
 * PDF API - Upload, download, and manage PDFs via R2 storage
 */

import { API_BASE } from '@config/api.js';

/**
 * Fetch a PDF from an external URL via the backend proxy (avoids CORS issues)
 * @param {string} url - The external PDF URL (e.g., from Unpaywall)
 * @returns {Promise<ArrayBuffer>} - The PDF data as ArrayBuffer
 */
export async function fetchPdfViaProxy(url) {
  const proxyUrl = `${API_BASE}/api/pdf-proxy`;

  const response = await fetch(proxyUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Proxy fetch failed' }));
    throw new Error(error.error || 'Failed to fetch PDF from external URL');
  }

  return response.arrayBuffer();
}

/**
 * Upload a PDF file for a study
 * @param {string} projectId - The project ID
 * @param {string} studyId - The study ID
 * @param {File|ArrayBuffer} file - The PDF file or ArrayBuffer
 * @param {string} [fileName] - Optional filename (required if file is ArrayBuffer)
 * @returns {Promise<{success: boolean, key: string, fileName: string, size: number}>}
 */
export async function uploadPdf(projectId, studyId, file, fileName = null) {
  const url = `${API_BASE}/api/projects/${projectId}/studies/${studyId}/pdf`;

  let body;
  let headers = {};

  if (file instanceof File) {
    const formData = new FormData();
    formData.append('file', file);
    body = formData;
  } else {
    // ArrayBuffer
    body = file;
    headers['Content-Type'] = 'application/pdf';
    headers['X-File-Name'] = fileName || 'document.pdf';
  }

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Failed to upload PDF');
  }

  return response.json();
}

/**
 * Download a PDF file from a study
 * @param {string} projectId - The project ID
 * @param {string} studyId - The study ID
 * @param {string} fileName - The PDF filename
 * @returns {Promise<ArrayBuffer>}
 */
export async function downloadPdf(projectId, studyId, fileName) {
  const url = `${API_BASE}/api/projects/${projectId}/studies/${studyId}/pdf/${encodeURIComponent(fileName)}`;

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Download failed' }));
    throw new Error(error.error || 'Failed to download PDF');
  }

  return response.arrayBuffer();
}

/**
 * Get the URL for a PDF (for direct embedding/viewing)
 * @param {string} projectId - The project ID
 * @param {string} studyId - The study ID
 * @param {string} fileName - The PDF filename
 * @returns {string}
 */
export function getPdfUrl(projectId, studyId, fileName) {
  return `${API_BASE}/api/projects/${projectId}/studies/${studyId}/pdf/${encodeURIComponent(fileName)}`;
}

/**
 * Delete a PDF from a study
 * @param {string} projectId - The project ID
 * @param {string} studyId - The study ID
 * @param {string} fileName - The PDF filename
 * @returns {Promise<{success: boolean}>}
 */
export async function deletePdf(projectId, studyId, fileName) {
  const url = `${API_BASE}/api/projects/${projectId}/studies/${studyId}/pdf/${encodeURIComponent(fileName)}`;

  const response = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(error.error || 'Failed to delete PDF');
  }

  return response.json();
}

/**
 * List all PDFs for a study
 * @param {string} projectId - The project ID
 * @param {string} studyId - The study ID
 * @returns {Promise<{pdfs: Array<{key: string, fileName: string, size: number, uploaded: string}>}>}
 */
export async function listPdfs(projectId, studyId) {
  const url = `${API_BASE}/api/projects/${projectId}/studies/${studyId}/pdfs`;

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'List failed' }));
    throw new Error(error.error || 'Failed to list PDFs');
  }

  return response.json();
}
