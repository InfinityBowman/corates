/**
 * useAddStudies - Coordinator for add studies state management
 *
 * Combines PDF uploads, reference imports, DOI/PMID lookups, and Google Drive files.
 * Handles matching PDFs to references and deduplication on submit.
 */

import { createMemo, createEffect } from 'solid-js';
import { showToast } from '@corates/ui';

import { createPdfOperations } from './pdfs.js';
import { createReferenceOperations } from './references.js';
import { createLookupOperations } from './lookup.js';
import { createDriveOperations } from './drive.js';
import { buildDeduplicatedStudies } from './deduplication.js';
import { findMatchingRef } from './matching.js';

/**
 * @param {Object} options
 * @param {boolean|Function} [options.collectMode] - If true, calls onStudiesChange with raw data
 * @param {Function} [options.onStudiesChange] - Called with collected data in collectMode
 */
export function useAddStudies(options = {}) {
  // Initialize sub-modules
  const pdfOps = createPdfOperations();
  const refOps = createReferenceOperations();
  const lookupOps = createLookupOperations();
  const driveOps = createDriveOperations();

  // Helper to check collectMode (can be function or value)
  const isCollectMode = () =>
    typeof options.collectMode === 'function' ? options.collectMode() : options.collectMode;

  // Computed values
  const totalStudyCount = createMemo(() => {
    return pdfOps.pdfCount() + refOps.refCount() + lookupOps.lookupCount() + driveOps.driveCount();
  });

  const hasAnyStudies = () => {
    return (
      pdfOps.uploadedPdfs.length > 0 ||
      refOps.selectedRefIds().size > 0 ||
      lookupOps.selectedLookupIds().size > 0 ||
      driveOps.selectedDriveFiles().length > 0
    );
  };

  // Effect: Match uploaded PDFs with lookup refs that need PDFs
  createEffect(() => {
    const pdfs = pdfOps.uploadedPdfs.filter(p => !p.extracting && p.data);
    const refs = lookupOps.lookupRefs();

    if (pdfs.length === 0 || refs.length === 0) return;

    const refsNeedingPdf = refs.filter(
      r => !r.manualPdfData && (!r.pdfAvailable || !r.pdfAccessible),
    );
    if (refsNeedingPdf.length === 0) return;

    let matchCount = 0;

    for (const ref of refsNeedingPdf) {
      const matchingPdf = findMatchingRef(ref, pdfs, pdf => !pdf.matchedToRef);

      if (matchingPdf) {
        lookupOps.markRefMatched(
          ref._id,
          matchingPdf.data,
          matchingPdf.file?.name || 'matched.pdf',
        );
        pdfOps.markPdfMatched(matchingPdf.id, ref.title || 'DOI reference');
        matchCount++;
      }
    }

    if (matchCount > 0) {
      showToast.success(
        'PDFs Matched',
        `Automatically matched ${matchCount} uploaded PDF${matchCount > 1 ? 's' : ''} with DOI/PMID references.`,
      );
    }
  });

  // Effect: Match PDFs with imported references
  createEffect(() => {
    const pdfs = refOps.refPdfFiles();
    const refs = refOps.importedRefs();

    if (pdfs.length === 0 || refs.length === 0) return;

    const unmatchedPdfs = pdfs.filter(p => !p.matched);
    if (unmatchedPdfs.length === 0) return;

    let matchCount = 0;

    for (const pdf of unmatchedPdfs) {
      const matchingRef = findMatchingRef(pdf, refs, ref => !ref.pdfData);

      if (matchingRef) {
        refOps.attachPdfToRef(matchingRef._id, pdf.data, pdf.fileName);
        refOps.markPdfMatched(pdf.id, matchingRef._id);
        matchCount++;
      }
    }

    if (matchCount > 0) {
      showToast.success(
        'PDFs Matched',
        `Automatically matched ${matchCount} PDF${matchCount > 1 ? 's' : ''} with imported references.`,
      );
    }
  });

  // Build deduplicated studies for submission
  function getStudiesToSubmit() {
    const selectedRefs = refOps.importedRefs().filter(r => refOps.selectedRefIds().has(r._id));
    const selectedLookups = lookupOps
      .lookupRefs()
      .filter(r => lookupOps.selectedLookupIds().has(r._id) && r.pdfAvailable);

    return buildDeduplicatedStudies({
      uploadedPdfs: pdfOps.uploadedPdfs,
      selectedRefs,
      selectedLookups,
      driveFiles: driveOps.selectedDriveFiles(),
    });
  }

  // Collect mode effect - notify parent of study changes
  createEffect(() => {
    if (!isCollectMode() || !options.onStudiesChange) return;

    // Trigger reactivity
    const _pdfs = pdfOps.uploadedPdfs.filter(p => p.title?.trim() && !p.extracting && p.data);
    const _selectedRefIds = refOps.selectedRefIds();
    const _selectedLookupIds = lookupOps.selectedLookupIds();
    const _driveFiles = driveOps.selectedDriveFiles();

    const mergedStudies = getStudiesToSubmit();

    // Separate into categories for backward compatibility
    const pdfs = [];
    const refs = [];
    const driveFiles = [];

    for (const study of mergedStudies) {
      if (study.pdfData) {
        pdfs.push({
          title: study.title,
          fileName: study.pdfFileName,
          data: study.pdfData,
          doi: study.doi,
          metadata: {
            firstAuthor: study.firstAuthor,
            publicationYear: study.publicationYear,
            authors: study.authors,
            journal: study.journal,
            doi: study.doi,
            abstract: study.abstract,
            pdfUrl: study.pdfUrl,
            pdfSource: study.pdfSource,
            pdfAccessible: study.pdfAccessible,
            importSource: study.importSource,
          },
        });
      } else if (study.googleDriveFileId) {
        driveFiles.push({
          id: study.googleDriveFileId,
          name: study.googleDriveFileName,
          importSource: 'google-drive',
          title: study.title,
          metadata: {
            firstAuthor: study.firstAuthor,
            publicationYear: study.publicationYear,
            authors: study.authors,
            journal: study.journal,
            doi: study.doi,
            abstract: study.abstract,
            pdfUrl: study.pdfUrl,
            pdfSource: study.pdfSource,
            pdfAccessible: study.pdfAccessible,
            importSource: study.importSource,
          },
        });
      } else {
        refs.push({
          title: study.title,
          pdfData: null,
          pdfFileName: null,
          metadata: {
            firstAuthor: study.firstAuthor,
            publicationYear: study.publicationYear,
            authors: study.authors,
            journal: study.journal,
            doi: study.doi,
            abstract: study.abstract,
            pdfUrl: study.pdfUrl,
            pdfSource: study.pdfSource,
            pdfAccessible: study.pdfAccessible,
            importSource: study.importSource,
          },
        });
      }
    }

    options.onStudiesChange({ pdfs, refs, lookups: [], driveFiles });
  });

  const clearAll = () => {
    pdfOps.clearPdfs();
    refOps.clearImportedRefs();
    lookupOps.clearLookupRefs();
    driveOps.clearDriveFiles();
  };

  // State serialization for OAuth redirect recovery
  const getSerializableState = () => ({
    uploadedPdfs: pdfOps.getSerializableState(),
    ...refOps.getSerializableState(),
    ...lookupOps.getSerializableState(),
    ...driveOps.getSerializableState(),
  });

  const restoreState = savedState => {
    if (!savedState) return;
    pdfOps.restoreState(savedState.uploadedPdfs);
    refOps.restoreState(savedState);
    lookupOps.restoreState(savedState);
    driveOps.restoreState(savedState);
  };

  // Return unified API matching the original interface
  return {
    // PDF state & handlers
    uploadedPdfs: pdfOps.uploadedPdfs,
    handlePdfSelect: pdfOps.handlePdfSelect,
    removePdf: pdfOps.removePdf,
    updatePdfTitle: pdfOps.updatePdfTitle,
    retryPdfExtraction: pdfOps.retryPdfExtraction,

    // Reference import state & handlers
    importedRefs: refOps.importedRefs,
    selectedRefIds: refOps.selectedRefIds,
    refFileName: refOps.refFileName,
    parsingRefs: refOps.parsingRefs,
    lookingUpRefPdfs: refOps.lookingUpRefPdfs,
    handleRefFileSelect: refOps.handleRefFileSelect,
    toggleRefSelection: refOps.toggleRefSelection,
    toggleSelectAllRefs: refOps.toggleSelectAllRefs,
    clearImportedRefs: refOps.clearImportedRefs,
    matchedRefPdfCount: refOps.matchedRefPdfCount,
    unmatchedRefPdfCount: refOps.unmatchedRefPdfCount,
    foundPdfCount: refOps.foundPdfCount,

    // DOI/PMID lookup state & handlers
    identifierInput: lookupOps.identifierInput,
    setIdentifierInput: lookupOps.setIdentifierInput,
    lookupRefs: lookupOps.lookupRefs,
    selectedLookupIds: lookupOps.selectedLookupIds,
    lookingUp: lookupOps.lookingUp,
    lookupErrors: lookupOps.lookupErrors,
    handleLookup: lookupOps.handleLookup,
    toggleLookupSelection: lookupOps.toggleLookupSelection,
    toggleSelectAllLookup: lookupOps.toggleSelectAllLookup,
    removeLookupRef: lookupOps.removeLookupRef,
    clearLookupRefs: lookupOps.clearLookupRefs,
    attachPdfToLookupRef: lookupOps.attachPdfToLookupRef,

    // Google Drive state & handlers
    selectedDriveFiles: driveOps.selectedDriveFiles,
    toggleDriveFile: driveOps.toggleDriveFile,
    removeDriveFile: driveOps.removeDriveFile,
    clearDriveFiles: driveOps.clearDriveFiles,

    // Computed values
    pdfCount: pdfOps.pdfCount,
    refCount: refOps.refCount,
    lookupCount: lookupOps.lookupCount,
    driveCount: driveOps.driveCount,
    totalStudyCount,
    hasAnyStudies,

    // Submit helpers
    getStudiesToSubmit,
    clearAll,

    // State persistence
    getSerializableState,
    restoreState,
  };
}
