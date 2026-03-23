/**
 * PDF actions -- view, download, upload, delete, metadata management
 */

import { uploadPdf, downloadPdf, deletePdf } from '@/api/pdf-api';
import { cachePdf, removeCachedPdf, getCachedPdf } from '@/primitives/pdfCache.js';
import { bestEffort } from '@/lib/errorLogger.js';
import { extractPdfDoi, extractPdfTitle } from '@/lib/pdfUtils.js';
import { fetchFromDOI } from '@/lib/referenceLookup.js';
import { useProjectStore } from '@/stores/projectStore';
import { usePdfPreviewStore } from '@/stores/pdfPreviewStore';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { connectionPool } from '../ConnectionPool';

async function extractPdfMetadata(
  arrayBuffer: ArrayBuffer | null,
): Promise<Record<string, unknown>> {
  const metadata: Record<string, unknown> = {};
  if (!arrayBuffer) return metadata;

  try {
    const [extractedTitle, extractedDoi] = await Promise.all([
      (extractPdfTitle as any)(arrayBuffer.slice(0)).catch(() => null),
      (extractPdfDoi as any)(arrayBuffer.slice(0)).catch(() => null),
    ]);

    if (extractedTitle) metadata.title = extractedTitle;
    if (extractedDoi) metadata.doi = extractedDoi;

    if (extractedDoi) {
      try {
        const refData = await (fetchFromDOI as any)(extractedDoi);
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
  async view(studyId: string, pdf: Record<string, unknown>): Promise<void> {
    if (!pdf?.fileName) return;
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    if (!projectId || !orgId) throw new Error('No active project connection');

    usePdfPreviewStore.getState().openPreview(projectId, studyId, pdf as any);

    try {
      let data = await getCachedPdf(projectId, studyId, pdf.fileName as string);

      if (!data) {
        data = await downloadPdf(orgId, projectId, studyId, pdf.fileName as string);
        await bestEffort(cachePdf(projectId, studyId, pdf.fileName as string, data), {
          operation: 'cachePdf (view)',
          projectId,
          studyId,
          fileName: pdf.fileName,
        });
      }

      usePdfPreviewStore.getState().setData(data);
    } catch (err) {
      console.error('Error loading PDF:', err);
      usePdfPreviewStore.getState().setError((err as Error).message || 'Failed to load PDF');
    }
  },

  async download(studyId: string, pdf: Record<string, unknown>): Promise<void> {
    if (!pdf?.fileName) return;
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    if (!projectId || !orgId) throw new Error('No active project connection');

    try {
      let data = await getCachedPdf(projectId, studyId, pdf.fileName as string);

      if (!data) {
        data = await downloadPdf(orgId, projectId, studyId, pdf.fileName as string);
      }

      const blob = new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdf.fileName as string;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      throw err;
    }
  },

  async upload(studyId: string, file: File, tag = 'secondary'): Promise<string> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    const user = selectUser(useAuthStore.getState());
    const userId = user?.id || null;
    const ops = connectionPool.getActiveOps();

    if (!projectId || !orgId || !ops) {
      throw new Error('No active project connection');
    }

    const study =
      useProjectStore.getState().projects[projectId]?.studies?.find((s: any) => s.id === studyId) ||
      null;
    const existingPdf = (study as any)?.pdfs?.find((pdf: any) => pdf.fileName === file.name);
    if (existingPdf) {
      throw new Error(`File "${file.name}" already exists. Rename or remove the existing copy.`);
    }

    let uploadResult: any = null;

    try {
      const hasPdfs = (study as any)?.pdfs?.length > 0;
      const effectiveTag = !hasPdfs ? 'primary' : tag;

      uploadResult = await uploadPdf(orgId, projectId, studyId, file, file.name);

      let arrayBuffer: ArrayBuffer | null = null;
      try {
        arrayBuffer = await file.arrayBuffer();
      } catch (err) {
        console.warn('Failed to convert file to ArrayBuffer:', (err as Error).message);
      }
      bestEffort(cachePdf(projectId, studyId, uploadResult.fileName, arrayBuffer!), {
        operation: 'cachePdf (upload)',
        projectId,
        studyId,
        fileName: uploadResult.fileName,
      });

      const pdfMetadata = await extractPdfMetadata(arrayBuffer);

      const pdfId = ops.addPdfToStudy(
        studyId,
        {
          key: uploadResult.key,
          fileName: uploadResult.fileName,
          size: uploadResult.size,
          uploadedBy: userId,
          uploadedAt: Date.now(),
          title: (pdfMetadata.title as string) || null,
          firstAuthor: (pdfMetadata.firstAuthor as string) || null,
          publicationYear: (pdfMetadata.publicationYear as string) || null,
          journal: (pdfMetadata.journal as string) || null,
          doi: (pdfMetadata.doi as string) || null,
        },
        effectiveTag,
      );

      return pdfId;
    } catch (err) {
      console.error('Error uploading PDF:', err);
      if (uploadResult?.fileName) {
        bestEffort(deletePdf(orgId, projectId, studyId, uploadResult.fileName), {
          operation: 'deletePdf (upload rollback)',
          projectId,
          studyId,
          fileName: uploadResult.fileName,
        });
      }
      throw err;
    }
  },

  async delete(studyId: string, pdf: Record<string, unknown>): Promise<void> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    const ops = connectionPool.getActiveOps();

    if (!pdf?.fileName || !projectId || !orgId || !ops) {
      throw new Error('No active project connection');
    }

    let r2Deleted = false;

    try {
      try {
        await deletePdf(orgId, projectId, studyId, pdf.fileName as string);
        r2Deleted = true;
      } catch (r2Err) {
        console.error('Failed to delete PDF from R2:', r2Err);
      }

      try {
        await removeCachedPdf(projectId, studyId, pdf.fileName as string);
      } catch (cacheErr) {
        console.warn('Failed to remove PDF from IndexedDB cache:', cacheErr);
      }

      if (r2Deleted) {
        try {
          ops.removePdfFromStudy(studyId, (pdf as any).id);
        } catch (yjsErr) {
          console.error('Failed to remove PDF from Y.js:', yjsErr);
          throw new Error('PDF deleted from R2 but failed to remove from study');
        }
      }

      if (!r2Deleted) {
        throw new Error('Failed to delete PDF from R2 storage');
      }
    } catch (err) {
      console.error('Error deleting PDF:', err);
      throw err;
    }
  },

  updateTag(studyId: string, pdfId: string, newTag: string): void {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    ops.updatePdfTag(studyId, pdfId, newTag);
  },

  updateMetadata(studyId: string, pdfId: string, metadata: Record<string, unknown>): void {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    ops.updatePdfMetadata(studyId, pdfId, metadata);
  },

  async handleGoogleDriveImport(studyId: string, file: any, tag = 'secondary'): Promise<void> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    const user = selectUser(useAuthStore.getState());
    const userId = user?.id || null;
    const ops = connectionPool.getActiveOps();

    if (!studyId || !file) return;
    if (!projectId || !orgId || !ops) throw new Error('No active project connection');

    const study =
      useProjectStore.getState().projects[projectId]?.studies?.find((s: any) => s.id === studyId) ||
      null;
    const hasPdfs = (study as any)?.pdfs?.length > 0;
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

      ops.addPdfToStudy(
        studyId,
        {
          key: file.key,
          fileName: file.fileName,
          size: file.size,
          uploadedBy: userId,
          uploadedAt: Date.now(),
          source: 'google-drive',
          title: (pdfMetadata.title as string) || null,
          firstAuthor: (pdfMetadata.firstAuthor as string) || null,
          publicationYear: (pdfMetadata.publicationYear as string) || null,
          journal: (pdfMetadata.journal as string) || null,
          doi: (pdfMetadata.doi as string) || null,
        },
        effectiveTag,
      );
    } catch (err) {
      console.error('Failed to add Google Drive PDF metadata:', err);
      bestEffort(deletePdf(orgId, projectId, studyId, file.fileName), {
        operation: 'deletePdf (Google Drive rollback)',
        projectId,
        studyId,
        fileName: file.fileName,
      });
      throw err;
    }
  },

  addToStudy(studyId: string, pdfMeta: Record<string, unknown>, tag?: string): void {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    ops.addPdfToStudy(studyId, pdfMeta, tag);
  },
};
