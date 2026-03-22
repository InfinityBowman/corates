/**
 * Study actions -- create, update, delete, batch import
 */

import { uploadPdf, fetchPdfViaProxy, downloadPdf, deletePdf } from '@/api/pdf-api';
import { cachePdf, clearStudyCache } from '@/primitives/pdfCache.js';
import { bestEffort } from '@/lib/errorLogger.js';
import { showToast } from '@/components/ui/toast';
import { importFromGoogleDrive } from '@/api/google-drive';
import { extractPdfDoi, extractPdfTitle } from '@/lib/pdfUtils.js';
import { fetchFromDOI } from '@/lib/referenceLookup.js';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { connectionPool, type ConnectionOps } from '../ConnectionPool';

// ---------------------------------------------------------------------------
// Pure helpers (no pool dependency)
// ---------------------------------------------------------------------------

function getStudyNameFromFilename(pdfFileName: string | null | undefined): string {
  if (!pdfFileName) return 'Untitled Study';
  return pdfFileName.replace(/\.pdf$/i, '');
}

async function extractPdfMetadataFromBuffer(
  arrayBuffer: ArrayBuffer,
  existingDoi: string | null,
  existingTitle: string | null,
): Promise<Record<string, unknown>> {
  const updates: Record<string, unknown> = {};

  const [extractedTitle, extractedDoi] = await Promise.all([
    (extractPdfTitle as any)(arrayBuffer.slice(0)).catch(() => null),
    (extractPdfDoi as any)(arrayBuffer.slice(0)).catch(() => null),
  ]);

  const resolvedTitle = extractedTitle || existingTitle;
  if (resolvedTitle && resolvedTitle !== existingTitle) {
    updates.originalTitle = resolvedTitle;
  }

  const resolvedDoi = extractedDoi || existingDoi;
  if (extractedDoi && !existingDoi) {
    updates.doi = extractedDoi;
  }

  if (resolvedDoi) {
    try {
      const refData = await (fetchFromDOI as any)(resolvedDoi);
      if (refData) {
        if (!updates.doi) updates.doi = refData.doi || resolvedDoi;
        if (refData.firstAuthor) updates.firstAuthor = refData.firstAuthor;
        if (refData.publicationYear) updates.publicationYear = refData.publicationYear;
        if (refData.authors) updates.authors = refData.authors;
        if (refData.journal) updates.journal = refData.journal;
        if (refData.abstract !== undefined) updates.abstract = refData.abstract;
        updates.importSource = 'pdf';
      }
    } catch (err) {
      console.warn('Failed to fetch DOI metadata:', err);
    }
  }

  return updates;
}

function filterDefinedUpdates(updates: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) filtered[key] = value;
  }
  return filtered;
}

async function addPdfMetadataToStudy(
  ops: ConnectionOps,
  studyId: string,
  pdfInfo: Record<string, unknown>,
  orgId: string,
  projectId: string,
  tag = 'primary',
): Promise<boolean> {
  try {
    ops.addPdfToStudy(studyId, pdfInfo, tag);
    return true;
  } catch (err) {
    console.error('Failed to add PDF metadata:', err);
    bestEffort(deletePdf(orgId, projectId, studyId, pdfInfo.fileName as string), {
      operation: 'deletePdf (rollback)',
      projectId,
      studyId,
      fileName: pdfInfo.fileName,
    });
    throw err;
  }
}

async function handleGoogleDrivePdf(
  ops: ConnectionOps,
  study: Record<string, unknown>,
  studyId: string,
  orgId: string,
  projectId: string,
  userId: string | null,
): Promise<boolean> {
  if (!study.googleDriveFileId) return false;

  try {
    const result = await importFromGoogleDrive(
      study.googleDriveFileId as string,
      projectId,
      studyId,
    );
    const importedFile = (result as any)?.file;
    if (!importedFile?.fileName) return false;

    await addPdfMetadataToStudy(
      ops,
      studyId,
      {
        key: importedFile.key,
        fileName: importedFile.fileName,
        size: importedFile.size,
        uploadedBy: userId,
        uploadedAt: Date.now(),
        source: 'google-drive',
      },
      orgId,
      projectId,
    );

    try {
      const arrayBuffer = await downloadPdf(orgId, projectId, studyId, importedFile.fileName);
      bestEffort(cachePdf(projectId, studyId, importedFile.fileName, arrayBuffer), {
        operation: 'cachePdf (Google Drive)',
        projectId,
        studyId,
        fileName: importedFile.fileName,
      });

      const metadataUpdates = await extractPdfMetadataFromBuffer(
        arrayBuffer,
        study.doi as string | null,
        study.title as string | null,
      );
      if (importedFile.fileName) {
        metadataUpdates.fileName = importedFile.fileName;
      }

      const filtered = filterDefinedUpdates(metadataUpdates);
      if (Object.keys(filtered).length > 0) {
        ops.updateStudy(studyId, filtered);
      }
    } catch (extractErr) {
      console.warn('Failed to extract metadata for Google Drive PDF:', extractErr);
    }

    return true;
  } catch (err) {
    console.error('Error importing PDF from Google Drive:', err);
    return false;
  }
}

async function fetchPdfFromUrl(
  study: Record<string, unknown>,
): Promise<{ pdfData: ArrayBuffer; pdfFileName: string } | null> {
  if (!study.pdfUrl || !study.pdfAccessible) return null;

  try {
    const pdfData = await fetchPdfViaProxy(study.pdfUrl as string);
    const safeName = ((study.doi as string) || (study.title as string) || 'document')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 50);
    return { pdfData, pdfFileName: `${safeName}.pdf` };
  } catch (err) {
    console.warn('Failed to fetch PDF from URL:', err);
    return null;
  }
}

async function uploadAndAttachPdf(
  ops: ConnectionOps,
  pdfData: ArrayBuffer,
  pdfFileName: string,
  studyId: string,
  orgId: string,
  projectId: string,
  userId: string | null,
): Promise<boolean> {
  try {
    const result = await uploadPdf(orgId, projectId, studyId, pdfData, pdfFileName);
    bestEffort(cachePdf(projectId, studyId, result.fileName, pdfData), {
      operation: 'cachePdf',
      projectId,
      studyId,
      fileName: result.fileName,
    });

    const pdfMetadata: Record<string, unknown> = {};
    try {
      const metadataUpdates = await extractPdfMetadataFromBuffer(pdfData, null, null);
      if (metadataUpdates.originalTitle) pdfMetadata.title = metadataUpdates.originalTitle;
      if (metadataUpdates.firstAuthor) pdfMetadata.firstAuthor = metadataUpdates.firstAuthor;
      if (metadataUpdates.publicationYear)
        pdfMetadata.publicationYear = metadataUpdates.publicationYear;
      if (metadataUpdates.journal) pdfMetadata.journal = metadataUpdates.journal;
      if (metadataUpdates.doi) pdfMetadata.doi = metadataUpdates.doi;
    } catch (extractErr) {
      console.warn('Failed to extract PDF metadata:', extractErr);
    }

    await addPdfMetadataToStudy(
      ops,
      studyId,
      {
        key: result.key,
        fileName: result.fileName,
        size: result.size,
        uploadedBy: userId,
        uploadedAt: Date.now(),
        title: (pdfMetadata.title as string) || null,
        firstAuthor: (pdfMetadata.firstAuthor as string) || null,
        publicationYear: (pdfMetadata.publicationYear as string) || null,
        journal: (pdfMetadata.journal as string) || null,
        doi: (pdfMetadata.doi as string) || null,
      },
      orgId,
      projectId,
    );
    return true;
  } catch (err) {
    console.error('Error uploading PDF:', err);
    return false;
  }
}

function showBatchResultToast(successCount: number, manualPdfCount: number): void {
  if (successCount === 0) return;
  const studyWord = successCount === 1 ? 'study' : 'studies';

  if (manualPdfCount > 0) {
    const pdfWord = manualPdfCount === 1 ? 'PDF requires' : 'PDFs require';
    showToast.info(
      'Studies Added',
      `Added ${successCount} ${studyWord}. ${manualPdfCount} ${pdfWord} manual download from the publisher.`,
    );
  } else {
    showToast.success('Studies Added', `Successfully added ${successCount} ${studyWord}.`);
  }
}

// ---------------------------------------------------------------------------
// Exported actions
// ---------------------------------------------------------------------------

export const studyActions = {
  create(name: string, description = '', metadata: Record<string, unknown> = {}): string | null {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    return ops.createStudy(name, description, metadata);
  },

  update(studyId: string, updates: Record<string, unknown>): void {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    try {
      ops.updateStudy(studyId, updates);
    } catch (err) {
      console.error('Error updating study:', err);
      showToast.error('Update Failed', 'Failed to update study');
    }
  },

  async delete(studyId: string): Promise<void> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    const ops = connectionPool.getActiveOps();
    if (!projectId || !orgId || !ops) {
      throw new Error('No active project connection');
    }

    try {
      const study =
        useProjectStore.getState().projects[projectId]?.studies?.find(
          (s: any) => s.id === studyId,
        ) || null;
      const pdfs = (study as any)?.pdfs || [];

      if (pdfs.length > 0) {
        const deletePromises = pdfs.map((pdf: any) => {
          if (!pdf?.fileName) return Promise.resolve();
          return bestEffort(deletePdf(orgId, projectId, studyId, pdf.fileName), {
            operation: 'deletePdf (study cleanup)',
            projectId,
            studyId,
            fileName: pdf.fileName,
          });
        });
        await Promise.all(deletePromises);
      }

      await bestEffort(clearStudyCache(projectId, studyId), {
        operation: 'clearStudyCache',
        projectId,
        studyId,
      });

      ops.deleteStudy(studyId);
    } catch (err) {
      console.error('Error deleting study:', err);
      showToast.error('Delete Failed', 'Failed to delete study');
    }
  },

  async addBatch(
    studiesToAdd: Record<string, unknown>[],
  ): Promise<{ successCount: number; manualPdfCount: number }> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    const user = selectUser(useAuthStore.getState());
    const userId = user?.id || null;
    const ops = connectionPool.getActiveOps();

    if (!projectId || !orgId || !ops) {
      throw new Error('No active project connection');
    }

    let successCount = 0;
    let manualPdfCount = 0;

    try {
      for (const study of studiesToAdd) {
        try {
          const metadata = {
            originalTitle: study.title || study.name || null,
            firstAuthor: study.firstAuthor,
            publicationYear: study.publicationYear,
            authors: study.authors,
            journal: study.journal,
            doi: study.doi,
            abstract: study.abstract,
            importSource: study.importSource,
            pdfUrl: study.pdfUrl,
            pdfSource: study.pdfSource,
          };

          const studyName = getStudyNameFromFilename(study.pdfFileName as string | null);
          const studyId = ops.createStudy(studyName, (study.abstract as string) || '', metadata);
          if (!studyId) continue;

          let pdfAttached = false;

          if (study.pdfData) {
            pdfAttached = await uploadAndAttachPdf(
              ops,
              study.pdfData as ArrayBuffer,
              study.pdfFileName as string,
              studyId,
              orgId,
              projectId,
              userId,
            );
          } else if (study.googleDriveFileId) {
            pdfAttached = await handleGoogleDrivePdf(
              ops,
              study,
              studyId,
              orgId,
              projectId,
              userId,
            );
          } else if (study.pdfUrl && study.pdfAccessible) {
            const fetched = await fetchPdfFromUrl(study);
            if (fetched) {
              pdfAttached = await uploadAndAttachPdf(
                ops,
                fetched.pdfData,
                fetched.pdfFileName,
                studyId,
                orgId,
                projectId,
                userId,
              );
            }
          }

          if (!pdfAttached && study.pdfUrl && !study.pdfAccessible) {
            manualPdfCount++;
          }

          successCount++;
        } catch (err) {
          console.error('Error adding study:', err);
        }
      }

      showBatchResultToast(successCount, manualPdfCount);
      return { successCount, manualPdfCount };
    } catch (err) {
      console.error('Error adding studies:', err);
      showToast.error('Addition Failed', 'Failed to add studies');
      throw err;
    }
  },

  importReferences(references: Record<string, unknown>[]): number {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');

    let successCount = 0;

    for (const ref of references) {
      try {
        const studyName = ref.pdfFileName
          ? getStudyNameFromFilename(ref.pdfFileName as string)
          : (ref.title as string) || 'Untitled Study';

        ops.createStudy(studyName, (ref.abstract as string) || '', {
          originalTitle: ref.title || null,
          firstAuthor: ref.firstAuthor,
          publicationYear: ref.publicationYear,
          authors: ref.authors,
          journal: ref.journal,
          doi: ref.doi,
          abstract: ref.abstract,
          importSource: 'reference-file',
        });
        successCount++;
      } catch (err) {
        console.error('Error importing reference:', err);
      }
    }

    if (successCount > 0) {
      showToast.success(
        'Import Complete',
        `Successfully imported ${successCount} ${successCount === 1 ? 'study' : 'studies'}.`,
      );
    }
    return successCount;
  },
};
