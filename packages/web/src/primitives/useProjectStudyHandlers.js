/**
 * useProjectStudyHandlers - Extracted handlers for study management
 * Reads from projectStore directly to avoid prop drilling
 */

import { uploadPdf, fetchPdfViaProxy } from '@api/pdf-api.js';
import { cachePdf } from '@primitives/pdfCache.js';
import { showToast } from '@components/zag/Toast.jsx';
import { generateStudyName, getDefaultNamingConvention } from '@/lib/studyNaming.js';
import projectStore from '@primitives/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';

/**
 * @param {string} projectId - The project ID
 * @param {Object} projectActions - Actions from useProject hook (createStudy, updateStudy, deleteStudy, addPdfToStudy)
 * @param {Object} confirmDialog - Confirm dialog instance
 */
export default function useProjectStudyHandlers(projectId, projectActions, confirmDialog) {
  const { user } = useBetterAuth();

  // Read from store directly
  const studies = () => projectStore.getStudies(projectId);
  const meta = () => projectStore.getMeta(projectId);

  const { createStudy, updateStudy, deleteStudy, addPdfToStudy } = projectActions;

  // Get the naming convention from project meta
  const getNamingConvention = () => meta()?.studyNamingConvention || getDefaultNamingConvention();

  // Unified handler for adding studies from AddStudiesForm
  const handleAddStudies = async studiesToAdd => {
    let successCount = 0;
    let manualPdfCount = 0;
    const namingConvention = getNamingConvention();

    try {
      for (const study of studiesToAdd) {
        try {
          const metadata = {
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

          // Generate study name based on naming convention
          const studyName = generateStudyName(study, namingConvention);

          const studyId = createStudy(studyName, study.abstract || '', metadata);

          // Handle PDF attachment - either from direct upload or from URL
          if (studyId) {
            let pdfData = study.pdfData;
            let pdfFileName = study.pdfFileName;

            // If no direct PDF data but we have a pdfUrl, check if it's accessible
            if (!pdfData && study.pdfUrl) {
              if (study.pdfAccessible) {
                // Repository-hosted PDFs can be auto-downloaded
                try {
                  pdfData = await fetchPdfViaProxy(study.pdfUrl);
                  // Generate filename from DOI or title
                  const safeName = (study.doi || study.title || 'document')
                    .replace(/[^a-zA-Z0-9.-]/g, '_')
                    .substring(0, 50);
                  pdfFileName = `${safeName}.pdf`;
                } catch (fetchErr) {
                  console.warn('Failed to fetch PDF from URL:', fetchErr);
                  manualPdfCount++;
                }
              } else {
                // Publisher-hosted PDFs need manual download
                manualPdfCount++;
              }
            }

            // Upload the PDF if we have data
            if (pdfData) {
              try {
                const result = await uploadPdf(projectId, studyId, pdfData, pdfFileName);
                cachePdf(projectId, studyId, result.fileName, pdfData).catch(err =>
                  console.warn('Failed to cache PDF:', err),
                );
                addPdfToStudy(studyId, {
                  key: result.key,
                  fileName: result.fileName,
                  size: result.size,
                  uploadedBy: user()?.id,
                  uploadedAt: Date.now(),
                });
              } catch (uploadErr) {
                console.error('Error uploading PDF:', uploadErr);
              }
            }
          }
          successCount++;
        } catch (err) {
          console.error('Error adding study:', err);
        }
      }

      if (successCount > 0) {
        if (manualPdfCount > 0) {
          showToast.info(
            'Studies Added',
            `Added ${successCount} ${successCount === 1 ? 'study' : 'studies'}. ${manualPdfCount} PDF${manualPdfCount === 1 ? ' requires' : 's require'} manual download from the publisher.`,
          );
        } else {
          showToast.success(
            'Studies Added',
            `Successfully added ${successCount} ${successCount === 1 ? 'study' : 'studies'}.`,
          );
        }
      }
      return { successCount, manualPdfCount };
    } catch (err) {
      console.error('Error adding studies:', err);
      showToast.error('Addition Failed', 'Failed to add studies');
      throw err;
    }
  };

  // Handle importing references from Zotero/EndNote files
  const handleImportReferences = references => {
    let successCount = 0;
    const namingConvention = getNamingConvention();

    for (const ref of references) {
      try {
        // Generate study name based on naming convention
        const studyName = generateStudyName(ref, namingConvention);

        createStudy(studyName, ref.abstract || '', {
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
  };

  const handleUpdateStudy = (studyId, updates) => {
    try {
      updateStudy(studyId, updates);
    } catch (err) {
      console.error('Error updating study:', err);
      showToast.error('Update Failed', 'Failed to update study');
    }
  };

  const handleDeleteStudy = async studyId => {
    const confirmed = await confirmDialog.open({
      title: 'Delete Study',
      description:
        'Are you sure you want to delete this study? This will also delete all checklists in it.',
      confirmText: 'Delete Study',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      deleteStudy(studyId);
    } catch (err) {
      console.error('Error deleting study:', err);
      showToast.error('Delete Failed', 'Failed to delete study');
    }
  };

  // Apply naming convention to all existing studies
  const handleApplyNamingToAll = async namingConvention => {
    const currentStudies = studies() || [];
    if (currentStudies.length === 0) return;

    let successCount = 0;
    for (const study of currentStudies) {
      try {
        // Generate new name based on study metadata
        const newName = generateStudyName(
          {
            title: study.name,
            firstAuthor: study.firstAuthor,
            publicationYear: study.publicationYear,
            authors: study.authors,
          },
          namingConvention,
        );

        // Only update if the name would change
        if (newName && newName !== study.name) {
          updateStudy(study.id, { name: newName });
          successCount++;
        }
      } catch (err) {
        console.error('Error renaming study:', err);
      }
    }

    if (successCount > 0) {
      showToast.success(
        'Studies Renamed',
        `Successfully renamed ${successCount} ${successCount === 1 ? 'study' : 'studies'}.`,
      );
    } else {
      showToast.info('No Changes', 'All studies already match the naming convention.');
    }
  };

  return {
    handleAddStudies,
    handleImportReferences,
    handleUpdateStudy,
    handleDeleteStudy,
    handleApplyNamingToAll,
  };
}
