/**
 * PDF API - Upload, download, and manage PDFs via R2 storage
 *
 * All endpoints use org-scoped routes: /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs
 */

import { API_BASE } from '@/config/api';
import { apiFetch } from '@/lib/apiFetch';
import { proxyPdfFetch } from '@/server/functions/pdf-proxy.functions';

export interface PdfUploadResponse {
  success: boolean;
  key: string;
  fileName: string;
  size: number;
}

export async function fetchPdfViaProxy(url: string): Promise<ArrayBuffer> {
  const { data } = await proxyPdfFetch({ data: { url } });
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

function buildPdfBasePath(orgId: string, projectId: string, studyId: string): string {
  return `/api/orgs/${orgId}/projects/${projectId}/studies/${studyId}/pdfs`;
}

export async function uploadPdf(
  orgId: string,
  projectId: string,
  studyId: string,
  file: File | ArrayBuffer,
  fileName: string | null = null,
): Promise<PdfUploadResponse> {
  const path = buildPdfBasePath(orgId, projectId, studyId);

  const formData = new FormData();

  if (file instanceof File) {
    formData.append('file', file);
  } else {
    const blob = new Blob([file], { type: 'application/pdf' });
    const fileObj = new File([blob], fileName || 'document.pdf', { type: 'application/pdf' });
    formData.append('file', fileObj);
  }

  return apiFetch<PdfUploadResponse>(path, {
    method: 'POST',
    body: formData,
  });
}

export async function downloadPdf(
  orgId: string,
  projectId: string,
  studyId: string,
  fileName: string,
): Promise<ArrayBuffer> {
  const basePath = buildPdfBasePath(orgId, projectId, studyId);
  const path = `${basePath}/${encodeURIComponent(fileName)}`;

  const response = await apiFetch<Response>(path, {
    method: 'GET',
    raw: true,
  });

  return response.arrayBuffer();
}

export function getPdfUrl(
  orgId: string,
  projectId: string,
  studyId: string,
  fileName: string,
): string {
  const basePath = buildPdfBasePath(orgId, projectId, studyId);
  return `${API_BASE}${basePath}/${encodeURIComponent(fileName)}`;
}

export async function deletePdf(
  orgId: string,
  projectId: string,
  studyId: string,
  fileName: string,
): Promise<{ success: boolean }> {
  const basePath = buildPdfBasePath(orgId, projectId, studyId);
  const path = `${basePath}/${encodeURIComponent(fileName)}`;

  return apiFetch.delete<{ success: boolean }>(path);
}
