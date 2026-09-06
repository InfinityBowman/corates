/**
 * PDF actions -- view, download, upload, delete, metadata management
 */

import { uploadPdf, downloadPdf, deletePdf } from '@/api/pdf-api';
import { cachePdf, removeCachedPdf, getCachedPdf } from '@/primitives/pdfCache.js';
import { bestEffort } from '@/lib/errorLogger.js';
import { captureException } from '@/config/sentry';
import { clientLogger } from '@/lib/clientLogger';
import { normalizeError } from '@corates/shared';
import { extractPdfDoi, extractPdfTitle } from '@/lib/pdfUtils.js';
import { fetchFromDOI } from '@/lib/referenceLookup.js';
import type { PdfCitationMetadata, PdfRow, PdfTag } from '@corates/shared/sync';
import type { PdfEntry } from '@/stores/projectStore';
import { usePdfPreviewStore } from '@/stores/pdfPreviewStore';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { connectionPool } from '../ConnectionPool';

type SyncClient = NonNullable<ReturnType<typeof connectionPool.getActiveClient>>;

function requireClient(): SyncClient {
  const client = connectionPool.getActiveClient();
  if (!client) throw new Error('No active project connection');
  return client;
}

/** The study's current PDF rows, from the active project's collections. */
function studyPdfRows(projectId: string, studyId: string): PdfRow[] {
  const collections = connectionPool.getCollections(projectId);
  return (collections?.pdfs.toArray ?? []).filter(pdf => pdf.studyId === studyId);
}

/**
 * Shape extracted citation metadata for `pdf.attach`/`pdf.updateMetadata`:
 * strings only, `publicationYear` coerced (reference lookups return numbers).
 */
function toCitationMetadata(metadata: Record<string, unknown>): PdfCitationMetadata {
  const shaped: Record<string, string> = {};
  for (const field of ['title', 'firstAuthor', 'publicationYear', 'journal', 'doi'] as const) {
    const value = metadata[field];
    if (value === undefined || value === null) continue;
    shaped[field] = String(value);
  }
  return shaped as PdfCitationMetadata;
}

async function extractPdfMetadata(
  arrayBuffer: ArrayBuffer | null,
): Promise<Record<string, unknown>> {
  const metadata: Record<string, unknown> = {};
  if (!arrayBuffer) return metadata;

  try {
    const [extractedTitle, extractedDoi] = await Promise.all([
      extractPdfTitle(arrayBuffer.slice(0)).catch(() => null),
      extractPdfDoi(arrayBuffer.slice(0)).catch(() => null),
    ]);

    if (extractedTitle) metadata.title = extractedTitle;
    if (extractedDoi) metadata.doi = extractedDoi;

    if (extractedDoi) {
      try {
        const refData = await fetchFromDOI(extractedDoi);
        if (refData) {
          if (refData.firstAuthor) metadata.firstAuthor = refData.firstAuthor;
          if (refData.publicationYear) metadata.publicationYear = refData.publicationYear;
          if (refData.journal) metadata.journal = refData.journal;
          if (!metadata.doi) metadata.doi = refData.doi || extractedDoi;
        }
      } catch (doiErr) {
        console.warn('Failed to fetch DOI metadata:', doiErr);
      }
    }
  } catch (extractErr) {
    console.warn('Failed to extract PDF metadata:', extractErr);
  }

  return metadata;
}

export const pdfActions = {
  async view(studyId: string, pdf: PdfEntry): Promise<void> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    if (!projectId || !orgId) throw new Error('No active project connection');

    usePdfPreviewStore.getState().openPreview(projectId, studyId, pdf);

    try {
      let data = await getCachedPdf(projectId, studyId, pdf.fileName);

      if (!data) {
        data = await downloadPdf(orgId, projectId, studyId, pdf.fileName);
        await bestEffort(cachePdf(projectId, studyId, pdf.fileName, data), {
          operation: 'cachePdf (view)',
          projectId,
          studyId,
          fileName: pdf.fileName,
        });
      }

      usePdfPreviewStore.getState().setData(data);
    } catch (err) {
      console.error('Error loading PDF:', err);
      clientLogger.warn('client.pdf.load_failed', {
        projectId,
        studyId,
        fileName: pdf.fileName,
        code: normalizeError(err).code,
      });
      captureException(err, {
        component: 'pdfActions',
        action: 'view',
        projectId,
        studyId,
        fileName: pdf.fileName,
      });
      usePdfPreviewStore.getState().setError((err as Error).message || 'Failed to load PDF');
    }
  },

  async download(studyId: string, pdf: PdfEntry): Promise<void> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    if (!projectId || !orgId) throw new Error('No active project connection');

    try {
      let data = await getCachedPdf(projectId, studyId, pdf.fileName);

      if (!data) {
        data = await downloadPdf(orgId, projectId, studyId, pdf.fileName);
      }

      const blob = new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdf.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      captureException(err, {
        component: 'pdfActions',
        action: 'download',
        projectId,
        studyId,
        fileName: pdf.fileName,
      });
      throw err;
    }
  },

  async upload(studyId: string, file: File, tag = 'secondary'): Promise<string> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    const user = selectUser(useAuthStore.getState());
    const userId = user?.id || null;
    const client = connectionPool.getActiveClient();

    if (!projectId || !orgId || !client) {
      throw new Error('No active project connection');
    }

    const existingPdfs = studyPdfRows(projectId, studyId);
    if (existingPdfs.some(pdf => pdf.fileName === file.name)) {
      throw new Error(`File "${file.name}" already exists. Rename or remove the existing copy.`);
    }

    let uploadResult: { success: boolean; key: string; fileName: string; size: number } | null =
      null;

    try {
      const effectiveTag = existingPdfs.length === 0 ? 'primary' : tag;

      uploadResult = await uploadPdf(orgId, projectId, studyId, file, file.name);

      let arrayBuffer: ArrayBuffer | null = null;
      try {
        arrayBuffer = await file.arrayBuffer();
      } catch (err) {
        console.warn('Failed to convert file to ArrayBuffer:', (err as Error).message);
      }
      if (arrayBuffer) {
        bestEffort(cachePdf(projectId, studyId, uploadResult.fileName, arrayBuffer), {
          operation: 'cachePdf (upload)',
          projectId,
          studyId,
          fileName: uploadResult.fileName,
        });
      }

      const pdfMetadata = await extractPdfMetadata(arrayBuffer);

      const pdfId = crypto.randomUUID();
      void client.mutate.pdf.attach({
        studyId,
        pdf: {
          id: pdfId,
          key: uploadResult.key,
          fileName: uploadResult.fileName,
          size: uploadResult.size,
          uploadedBy: userId ?? '',
          uploadedAt: Date.now(),
          ...toCitationMetadata(pdfMetadata),
        },
        tag: effectiveTag as PdfTag,
        now: Date.now(),
      });

      return pdfId;
    } catch (err) {
      console.error('Error uploading PDF:', err);
      clientLogger.warn('client.pdf.upload_failed', {
        projectId,
        studyId,
        fileName: file.name,
        size: file.size,
        code: normalizeError(err).code,
      });
      captureException(err, {
        component: 'pdfActions',
        action: 'upload',
        projectId,
        studyId,
        fileName: file.name,
        size: file.size,
      });
      if (uploadResult?.fileName) {
        bestEffort(deletePdf(orgId, projectId, studyId, uploadResult.fileName), {
          capture: true,
          operation: 'deletePdf (upload rollback)',
          projectId,
          studyId,
          fileName: uploadResult.fileName,
        });
      }
      throw err;
    }
  },

  async delete(studyId: string, pdf: PdfEntry): Promise<void> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    const client = connectionPool.getActiveClient();

    if (!projectId || !orgId || !client) {
      throw new Error('No active project connection');
    }

    try {
      let r2Deleted = false;
      try {
        await deletePdf(orgId, projectId, studyId, pdf.fileName);
        r2Deleted = true;
      } catch (r2Err) {
        console.error('Failed to delete PDF from R2:', r2Err);
        // Captured here rather than in the outer catch: the rethrow below
        // synthesizes a generic Error that would lose this cause.
        captureException(r2Err, {
          component: 'pdfActions',
          action: 'delete.r2',
          projectId,
          studyId,
          fileName: pdf.fileName,
        });
      }

      try {
        await removeCachedPdf(projectId, studyId, pdf.fileName);
      } catch (cacheErr) {
        console.warn('Failed to remove PDF from IndexedDB cache:', cacheErr);
      }

      if (!r2Deleted) {
        throw new Error('Failed to delete PDF from R2 storage');
      }

      void client.mutate.pdf.remove({ pdfId: pdf.id, now: Date.now() });
    } catch (err) {
      console.error('Error deleting PDF:', err);
      throw err;
    }
  },

  updateTag(_studyId: string, pdfId: string, newTag: string): void {
    const client = requireClient();
    void client.mutate.pdf.updateTag({ pdfId, tag: newTag as PdfTag, now: Date.now() });
  },

  updateMetadata(_studyId: string, pdfId: string, metadata: Record<string, unknown>): void {
    const client = requireClient();
    // Empty strings pass through: `pdf.updateMetadata` deletes fields set to ''.
    const shaped: Record<string, string> = {};
    for (const field of ['title', 'firstAuthor', 'publicationYear', 'journal', 'doi'] as const) {
      if (field in metadata && metadata[field] !== undefined) {
        shaped[field] = metadata[field] === null ? '' : String(metadata[field]);
      }
    }
    void client.mutate.pdf.updateMetadata({
      pdfId,
      metadata: shaped as PdfCitationMetadata,
      now: Date.now(),
    });
  },

  async handleGoogleDriveImport(
    studyId: string,
    file: { key: string; fileName: string; size: number },
    tag = 'secondary',
  ): Promise<void> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    const user = selectUser(useAuthStore.getState());
    const userId = user?.id || null;
    const client = connectionPool.getActiveClient();

    if (!studyId || !file) return;
    if (!projectId || !orgId || !client) throw new Error('No active project connection');

    const hasPdfs = studyPdfRows(projectId, studyId).length > 0;
    const effectiveTag = !hasPdfs ? 'primary' : tag;

    try {
      let arrayBuffer: ArrayBuffer | null = null;
      try {
        arrayBuffer = await downloadPdf(orgId, projectId, studyId, file.fileName);
        bestEffort(cachePdf(projectId, studyId, file.fileName, arrayBuffer), {
          operation: 'cachePdf (Google Drive import)',
          projectId,
          studyId,
          fileName: file.fileName,
        });
      } catch (downloadErr) {
        console.warn('Failed to download/cache Google Drive PDF:', downloadErr);
      }

      const pdfMetadata = await extractPdfMetadata(arrayBuffer);

      void client.mutate.pdf.attach({
        studyId,
        pdf: {
          id: crypto.randomUUID(),
          key: file.key,
          fileName: file.fileName,
          size: file.size,
          uploadedBy: userId ?? '',
          uploadedAt: Date.now(),
          ...toCitationMetadata(pdfMetadata),
        },
        tag: effectiveTag as PdfTag,
        now: Date.now(),
      });
    } catch (err) {
      console.error('Failed to add Google Drive PDF metadata:', err);
      captureException(err, {
        component: 'pdfActions',
        action: 'handleGoogleDriveImport',
        projectId,
        studyId,
        fileName: file.fileName,
      });
      bestEffort(deletePdf(orgId, projectId, studyId, file.fileName), {
        capture: true,
        operation: 'deletePdf (Google Drive rollback)',
        projectId,
        studyId,
        fileName: file.fileName,
      });
      throw err;
    }
  },

  addToStudy(studyId: string, pdfMeta: Record<string, unknown>, tag?: string): void {
    const client = requireClient();
    void client.mutate.pdf.attach({
      studyId,
      pdf: {
        id: crypto.randomUUID(),
        key: String(pdfMeta.key ?? ''),
        fileName: String(pdfMeta.fileName ?? ''),
        size: Number(pdfMeta.size ?? 0),
        uploadedBy: String(pdfMeta.uploadedBy ?? ''),
        uploadedAt: typeof pdfMeta.uploadedAt === 'number' ? pdfMeta.uploadedAt : undefined,
        ...toCitationMetadata(pdfMeta),
      },
      tag: (tag ?? 'secondary') as PdfTag,
      now: Date.now(),
    });
  },
};
