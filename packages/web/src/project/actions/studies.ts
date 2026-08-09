/**
 * Study actions -- create, update, delete, batch import
 */

import { uploadPdf, fetchPdfViaProxy, downloadPdf, deletePdf } from '@/api/pdf-api';
import { cachePdf, clearStudyCache } from '@/primitives/pdfCache.js';
import { bestEffort } from '@/lib/errorLogger.js';
import { captureException } from '@/config/sentry';
import { showToast } from '@/lib/toast';
import { importFromGoogleDrive } from '@/api/google-drive';
import { extractPdfDoi, extractPdfTitle } from '@/lib/pdfUtils.js';
import { fetchFromDOI } from '@/lib/referenceLookup.js';
import type { StudyMetadata } from '@corates/shared/sync';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { connectionPool } from '../ConnectionPool';

type SyncClient = NonNullable<ReturnType<typeof connectionPool.getActiveClient>>;

type StudyUpdates = StudyMetadata & {
  name?: string;
  description?: string;
  reviewer1?: string | null;
  reviewer2?: string | null;
};

function requireClient(): SyncClient {
  const client = connectionPool.getActiveClient();
  if (!client) throw new Error('No active project connection');
  return client;
}

// ---------------------------------------------------------------------------
// Pure helpers (no pool dependency)
// ---------------------------------------------------------------------------

function getStudyNameFromFilename(pdfFileName: string | null | undefined): string {
  if (!pdfFileName) return 'Untitled Study';
  return pdfFileName.replace(/\.pdf$/i, '');
}

/**
 * Shape loose caller-supplied updates for the study mutators: drop null/
 * undefined values (the Zod schemas take strings, not nulls) and coerce
 * `publicationYear` to a string (reference lookups return numbers). The
 * reviewer fields keep null: it is the un-assign signal `study.update`
 * deletes the key on.
 */
function toStudyUpdates(updates: Record<string, unknown>): StudyUpdates {
  const shaped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (value === null && key !== 'reviewer1' && key !== 'reviewer2') continue;
    shaped[key] = key === 'publicationYear' ? String(value) : value;
  }
  return shaped as StudyUpdates;
}

async function extractPdfMetadataFromBuffer(
  arrayBuffer: ArrayBuffer,
  existingDoi: string | null,
  existingTitle: string | null,
): Promise<Record<string, unknown>> {
  const updates: Record<string, unknown> = {};

  const [extractedTitle, extractedDoi] = await Promise.all([
    extractPdfTitle(arrayBuffer.slice(0)).catch(() => null),
    extractPdfDoi(arrayBuffer.slice(0)).catch(() => null),
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
      const refData = await fetchFromDOI(resolvedDoi);
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

function attachPdfToStudy(
  client: SyncClient,
  studyId: string,
  pdfInfo: {
    key: string;
    fileName: string;
    size: number;
    uploadedBy: string;
    uploadedAt?: number;
    title?: string;
    firstAuthor?: string;
    publicationYear?: string;
    journal?: string;
    doi?: string;
  },
  tag = 'primary',
): string {
  const pdfId = crypto.randomUUID();
  void client.mutate.pdf.attach({
    studyId,
    pdf: { id: pdfId, ...pdfInfo },
    tag: tag as 'primary' | 'protocol' | 'secondary',
    now: Date.now(),
  });
  return pdfId;
}

async function handleGoogleDrivePdf(
  client: SyncClient,
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
    const importedFile = result.file;
    if (!importedFile?.fileName) return false;

    attachPdfToStudy(client, studyId, {
      key: importedFile.key,
      fileName: importedFile.fileName,
      size: importedFile.size,
      uploadedBy: userId ?? '',
      uploadedAt: Date.now(),
    });

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

      const shaped = toStudyUpdates(metadataUpdates);
      if (Object.keys(shaped).length > 0) {
        void client.mutate.study.update({ id: studyId, updates: shaped, now: Date.now() });
      }
    } catch (extractErr) {
      console.warn('Failed to extract metadata for Google Drive PDF:', extractErr);
    }

    return true;
  } catch (err) {
    console.error('Error importing PDF from Google Drive:', err);
    captureException(err, { component: 'studyActions', action: 'importPdfFromGoogleDrive' });
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
  client: SyncClient,
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

    attachPdfToStudy(client, studyId, {
      key: result.key,
      fileName: result.fileName,
      size: result.size,
      uploadedBy: userId ?? '',
      uploadedAt: Date.now(),
      title: (pdfMetadata.title as string) || undefined,
      firstAuthor: (pdfMetadata.firstAuthor as string) || undefined,
      publicationYear:
        pdfMetadata.publicationYear !== undefined ? String(pdfMetadata.publicationYear) : undefined,
      journal: (pdfMetadata.journal as string) || undefined,
      doi: (pdfMetadata.doi as string) || undefined,
    });
    return true;
  } catch (err) {
    console.error('Error uploading PDF:', err);
    captureException(err, { component: 'studyActions', action: 'uploadAndAttachPdf' });
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
    const client = requireClient();
    const studyId = crypto.randomUUID();
    void client.mutate.study.create({
      id: studyId,
      name,
      description,
      metadata: toStudyUpdates(metadata),
      now: Date.now(),
    });
    return studyId;
  },

  update(studyId: string, updates: Record<string, unknown>): void {
    const client = requireClient();
    void client.mutate.study.update({
      id: studyId,
      updates: toStudyUpdates(updates),
      now: Date.now(),
    });
  },

  async delete(studyId: string): Promise<void> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    const client = connectionPool.getActiveClient();
    if (!projectId || !orgId || !client) {
      throw new Error('No active project connection');
    }

    try {
      const collections = connectionPool.getCollections(projectId);
      const pdfFileNames = (collections?.pdfs.toArray ?? [])
        .filter(pdf => pdf.studyId === studyId)
        .map(pdf => pdf.fileName);

      if (pdfFileNames.length > 0) {
        const deletePromises = pdfFileNames.map(fileName => {
          return bestEffort(deletePdf(orgId, projectId, studyId, fileName), {
            capture: true,
            operation: 'deletePdf (study cleanup)',
            projectId,
            studyId,
            fileName,
          });
        });
        await Promise.all(deletePromises);
      }

      await bestEffort(clearStudyCache(projectId, studyId), {
        operation: 'clearStudyCache',
        projectId,
        studyId,
      });

      // Cascades checklist/answer/pdf/annotation/reconciliation rows server-side.
      void client.mutate.study.delete({ id: studyId });
    } catch (err) {
      console.error('Error deleting study:', err);
      captureException(err, {
        component: 'studyActions',
        action: 'delete',
        projectId,
        studyId,
      });
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
    const client = connectionPool.getActiveClient();

    if (!projectId || !orgId || !client) {
      throw new Error('No active project connection');
    }

    let successCount = 0;
    let manualPdfCount = 0;

    try {
      for (const study of studiesToAdd) {
        try {
          const metadata = toStudyUpdates({
            originalTitle: (study.title as string) || (study.name as string) || undefined,
            firstAuthor: (study.firstAuthor as string) || undefined,
            publicationYear: study.publicationYear ?? undefined,
            authors: (study.authors as string) || undefined,
            journal: (study.journal as string) || undefined,
            doi: (study.doi as string) || undefined,
            abstract: (study.abstract as string) || undefined,
            importSource: (study.importSource as string) || undefined,
            pdfUrl: (study.pdfUrl as string) || undefined,
            pdfSource: (study.pdfSource as string) || undefined,
          });

          const studyName = getStudyNameFromFilename(
            (study.pdfFileName as string) || (study.googleDriveFileName as string) || null,
          );
          const studyId = crypto.randomUUID();
          void client.mutate.study.create({
            id: studyId,
            name: studyName,
            description: (study.abstract as string) || '',
            metadata,
            now: Date.now(),
          });

          let pdfAttached = false;

          if (study.pdfData) {
            pdfAttached = await uploadAndAttachPdf(
              client,
              study.pdfData as ArrayBuffer,
              study.pdfFileName as string,
              studyId,
              orgId,
              projectId,
              userId,
            );
          } else if (study.googleDriveFileId) {
            pdfAttached = await handleGoogleDrivePdf(
              client,
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
                client,
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
          captureException(err, { component: 'studyActions', action: 'addBatch.study' });
        }
      }

      showBatchResultToast(successCount, manualPdfCount);
      return { successCount, manualPdfCount };
    } catch (err) {
      console.error('Error adding studies:', err);
      captureException(err, { component: 'studyActions', action: 'addBatch' });
      showToast.error('Addition Failed', 'Failed to add studies');
      throw err;
    }
  },

  importReferences(references: Record<string, unknown>[]): number {
    const client = requireClient();

    const studies = references.map(ref => {
      const studyName =
        ref.pdfFileName ?
          getStudyNameFromFilename(ref.pdfFileName as string)
        : (ref.title as string) || 'Untitled Study';

      return {
        id: crypto.randomUUID(),
        name: studyName,
        description: (ref.abstract as string) || '',
        metadata: toStudyUpdates({
          originalTitle: (ref.title as string) || undefined,
          firstAuthor: (ref.firstAuthor as string) || undefined,
          publicationYear: ref.publicationYear ?? undefined,
          authors: (ref.authors as string) || undefined,
          journal: (ref.journal as string) || undefined,
          doi: (ref.doi as string) || undefined,
          abstract: (ref.abstract as string) || undefined,
          importSource: 'reference-file',
        }),
      };
    });

    if (studies.length > 0) {
      void client.mutate.study.importBatch({ studies, now: Date.now() });
      showToast.success(
        'Import Complete',
        `Successfully imported ${studies.length} ${studies.length === 1 ? 'study' : 'studies'}.`,
      );
    }
    return studies.length;
  },
};
