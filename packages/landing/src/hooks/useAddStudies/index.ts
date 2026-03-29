/**
 * useAddStudies - Coordinator for add studies state management (React version)
 *
 * Combines PDF uploads, reference imports, DOI/PMID lookups, and Google Drive files.
 * Handles matching PDFs to references and deduplication on submit.
 */

import { useMemo, useEffect, useCallback, useRef } from 'react';
import { showToast } from '@/components/ui/toast';

import { usePdfOperations } from './pdfs';
import { useReferenceOperations } from './references';
import { useLookupOperations } from './lookup';
import { useDriveOperations } from './drive';
import { buildDeduplicatedStudies } from './deduplication';
import type { MergedStudy } from './deduplication';
import { findMatchingRef } from './matching';

export type {
  MergedStudy,
  StudySource,
  UploadedPdf,
  ImportedRef,
  LookupRef,
  DriveFile,
  StudyMetadata,
} from './deduplication';
export type { RefPdfFile } from './references';

interface CollectedPdf {
  title: string;
  fileName: string | null;
  data: ArrayBuffer | null;
  doi: string | null;
  metadata: {
    firstAuthor: string | null;
    publicationYear: number | string | null;
    authors: string[] | null;
    journal: string | null;
    doi: string | null;
    abstract: string | null;
    pdfUrl: string | null;
    pdfSource: string | null;
    pdfAccessible: boolean;
    importSource: string;
  };
}

interface CollectedRef {
  title: string;
  pdfData: null;
  pdfFileName: null;
  metadata: {
    firstAuthor: string | null;
    publicationYear: number | string | null;
    authors: string[] | null;
    journal: string | null;
    doi: string | null;
    abstract: string | null;
    importSource: string;
  };
}

interface CollectedDriveFile {
  id: string | null;
  name: string | null;
  importSource: string;
  title: string;
  metadata: {
    firstAuthor: string | null;
    publicationYear: number | string | null;
    authors: string[] | null;
    journal: string | null;
    doi: string | null;
    abstract: string | null;
    importSource: string;
  };
}

interface CollectedStudies {
  pdfs: CollectedPdf[];
  refs: CollectedRef[];
  lookups: never[];
  driveFiles: CollectedDriveFile[];
}

interface UseAddStudiesOptions {
  collectMode?: boolean;
  onStudiesChange?: (data: CollectedStudies) => void;
}

export function useAddStudies(options: UseAddStudiesOptions = {}) {
  const pdfOps = usePdfOperations();
  const refOps = useReferenceOperations();
  const lookupOps = useLookupOperations();
  const driveOps = useDriveOperations();

  // Stable ref for callback to avoid infinite effect loops
  const onStudiesChangeRef = useRef(options.onStudiesChange);
  useEffect(() => {
    onStudiesChangeRef.current = options.onStudiesChange;
  });

  const totalStudyCount =
    pdfOps.pdfCount + refOps.refCount + lookupOps.lookupCount + driveOps.driveCount;

  const stagedStudiesPreview = useMemo(() => {
    const selectedRefs = refOps.importedRefs.filter(r => refOps.selectedRefIds.has(r._id));
    const selectedLookups = lookupOps.lookupRefs.filter(
      r => lookupOps.selectedLookupIds.has(r._id) && r.pdfAvailable,
    );

    return buildDeduplicatedStudies({
      uploadedPdfs: pdfOps.uploadedPdfs,
      selectedRefs,
      selectedLookups,
      driveFiles: driveOps.selectedDriveFiles,
    });
  }, [
    pdfOps.uploadedPdfs,
    refOps.importedRefs,
    refOps.selectedRefIds,
    lookupOps.lookupRefs,
    lookupOps.selectedLookupIds,
    driveOps.selectedDriveFiles,
  ]);

  const hasAnyStudies = useCallback(
    () =>
      pdfOps.uploadedPdfs.length > 0 ||
      refOps.selectedRefIds.size > 0 ||
      lookupOps.selectedLookupIds.size > 0 ||
      driveOps.selectedDriveFiles.length > 0,
    [
      pdfOps.uploadedPdfs,
      refOps.selectedRefIds,
      lookupOps.selectedLookupIds,
      driveOps.selectedDriveFiles,
    ],
  );

  // Match uploaded PDFs with lookup refs that need PDFs
  useEffect(() => {
    const pdfs = pdfOps.uploadedPdfs.filter(p => !p.extracting && p.data);
    const refs = lookupOps.lookupRefs;

    if (pdfs.length === 0 || refs.length === 0) return;

    const refsNeedingPdf = refs.filter(
      r => !r.manualPdfData && (!r.pdfAvailable || !r.pdfAccessible),
    );
    if (refsNeedingPdf.length === 0) return;

    let matchCount = 0;
    const matchedPdfIds = new Set<string>();
    for (const ref of refsNeedingPdf) {
      const matchingPdf = findMatchingRef(
        ref,
        pdfs,
        pdf => !pdf.matchedToRef && !matchedPdfIds.has(pdf.id),
      );
      if (matchingPdf) {
        matchedPdfIds.add(matchingPdf.id);
        lookupOps.markRefMatched(
          ref._id,
          matchingPdf.data!,
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
  }, [pdfOps.uploadedPdfs, lookupOps.lookupRefs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Match PDFs with imported references
  useEffect(() => {
    const pdfs = refOps.refPdfFiles;
    const refs = refOps.importedRefs;

    if (pdfs.length === 0 || refs.length === 0) return;

    const unmatchedPdfs = pdfs.filter(p => !p.matched);
    if (unmatchedPdfs.length === 0) return;

    let matchCount = 0;
    const matchedRefIds = new Set<string>();
    for (const pdf of unmatchedPdfs) {
      const matchingRef = findMatchingRef(
        pdf,
        refs,
        ref => !ref.pdfData && !matchedRefIds.has(ref._id),
      );
      if (matchingRef) {
        matchedRefIds.add(matchingRef._id);
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
  }, [refOps.refPdfFiles, refOps.importedRefs]); // eslint-disable-line react-hooks/exhaustive-deps

  const getStudiesToSubmit = useCallback((): MergedStudy[] => {
    const selectedRefs = refOps.importedRefs.filter(r => refOps.selectedRefIds.has(r._id));
    const selectedLookups = lookupOps.lookupRefs.filter(
      r => lookupOps.selectedLookupIds.has(r._id) && r.pdfAvailable,
    );

    return buildDeduplicatedStudies({
      uploadedPdfs: pdfOps.uploadedPdfs,
      selectedRefs,
      selectedLookups,
      driveFiles: driveOps.selectedDriveFiles,
    });
  }, [
    pdfOps.uploadedPdfs,
    refOps.importedRefs,
    refOps.selectedRefIds,
    lookupOps.lookupRefs,
    lookupOps.selectedLookupIds,
    driveOps.selectedDriveFiles,
  ]);

  // Collect mode effect
  useEffect(() => {
    if (!options.collectMode || !onStudiesChangeRef.current) return;

    const mergedStudies = getStudiesToSubmit();
    const pdfs: CollectedPdf[] = [];
    const refs: CollectedRef[] = [];
    const driveFiles: CollectedDriveFile[] = [];

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
            importSource: study.importSource,
          },
        });
      }
    }

    onStudiesChangeRef.current({ pdfs, refs, lookups: [], driveFiles });
  }, [getStudiesToSubmit, options.collectMode]);

  const clearAll = useCallback(() => {
    pdfOps.clearPdfs();
    refOps.clearImportedRefs();
    lookupOps.clearLookupRefs();
    driveOps.clearDriveFiles();
  }, [pdfOps, refOps, lookupOps, driveOps]);

  const removeStagedStudy = useCallback(
    (study: MergedStudy) => {
      if (!study.sources || !Array.isArray(study.sources)) return;
      for (const source of study.sources) {
        switch (source.type) {
          case 'pdf':
            pdfOps.removePdf(source.sourceId);
            break;
          case 'ref':
            refOps.toggleRefSelection(source.sourceId);
            break;
          case 'lookup':
            lookupOps.removeLookupRef(source.sourceId);
            break;
          case 'drive':
            driveOps.removeDriveFile(source.sourceId);
            break;
        }
      }
    },
    [pdfOps, refOps, lookupOps, driveOps],
  );

  const getSerializableState = useCallback(
    () => ({
      uploadedPdfs: pdfOps.getSerializableState(),
      ...refOps.getSerializableState(),
      ...lookupOps.getSerializableState(),
      ...driveOps.getSerializableState(),
    }),
    [pdfOps, refOps, lookupOps, driveOps],
  );

  const restoreState = (savedState: Record<string, unknown> | null) => {
    if (!savedState) return;
    pdfOps.restoreState(savedState.uploadedPdfs as Parameters<typeof pdfOps.restoreState>[0]);
    refOps.restoreState(savedState as Parameters<typeof refOps.restoreState>[0]);
    lookupOps.restoreState(savedState as Parameters<typeof lookupOps.restoreState>[0]);
    driveOps.restoreState(savedState as Parameters<typeof driveOps.restoreState>[0]);
  };

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
    stagedStudiesPreview,

    // Submit helpers
    getStudiesToSubmit,
    clearAll,
    removeStagedStudy,

    // State persistence
    getSerializableState,
    restoreState,
  };
}
