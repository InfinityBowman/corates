/**
 * Reference import operations for useAddStudies (React version)
 */

import { useState, useCallback } from 'react';
import { showToast } from '@/components/ui/toast';
import { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } from '@/lib/pdfUtils.js';
import { parseReferenceFile, separateFileTypes } from '@/lib/referenceParser.js';
import { checkPdfAvailability } from '@/lib/referenceLookup.js';
import { cloneArrayBuffer } from './serialization';
import type { ImportedRef } from './deduplication';

interface RefPdfFile {
  id: string;
  file?: { name: string; type?: string; size?: number } | null;
  fileName: string;
  title: string;
  data: ArrayBuffer;
  doi: string | null;
  matched: boolean;
  matchedRefId: string | null;
}

interface SerializedRefPdf {
  id: string;
  fileName: string;
  title: string;
  data: ArrayBuffer | null;
  doi: string | null;
  matched: boolean;
  matchedRefId: string | null;
  fileType: string | null;
  fileSize: number | null;
}

interface SerializedImportedRef {
  _id: string;
  title: string;
  doi?: string | null;
  firstAuthor?: string | null;
  publicationYear?: number | string | null;
  authors?: string[] | null;
  journal?: string | null;
  abstract?: string | null;
  pdfUrl?: string | null;
  pdfSource?: string | null;
  pdfAccessible?: boolean;
  pdfAvailable?: boolean;
  pdfData?: ArrayBuffer | null;
  pdfFileName?: string | null;
}

interface RefSerializableState {
  importedRefs: SerializedImportedRef[];
  selectedRefIds: string[];
  refFileName: string;
  refPdfFiles: SerializedRefPdf[];
}

interface RefRestorable {
  importedRefs?: ImportedRef[];
  selectedRefIds?: string[];
  refFileName?: string;
  refPdfFiles?: SerializedRefPdf[];
}

interface ReferenceOperations {
  importedRefs: ImportedRef[];
  selectedRefIds: Set<string>;
  refFileName: string;
  parsingRefs: boolean;
  refPdfFiles: RefPdfFile[];
  lookingUpRefPdfs: boolean;
  refCount: number;
  matchedRefPdfCount: number;
  unmatchedRefPdfCount: number;
  foundPdfCount: number;
  handleRefFileSelect: (files: File[]) => Promise<void>;
  toggleRefSelection: (id: string) => void;
  toggleSelectAllRefs: () => void;
  clearImportedRefs: () => void;
  attachPdfToRef: (refId: string, pdfData: ArrayBuffer, pdfFileName: string) => void;
  markPdfMatched: (pdfId: string, refId: string) => void;
  getSerializableState: () => RefSerializableState;
  restoreState: (savedState: RefRestorable) => void;
}

export function useReferenceOperations(): ReferenceOperations {
  const [importedRefs, setImportedRefs] = useState<ImportedRef[]>([]);
  const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(new Set());
  const [refFileName, setRefFileName] = useState('');
  const [parsingRefs, setParsingRefs] = useState(false);
  const [refPdfFiles, setRefPdfFiles] = useState<RefPdfFile[]>([]);
  const [lookingUpRefPdfs, setLookingUpRefPdfs] = useState(false);

  const refCount = selectedRefIds.size;
  const matchedRefPdfCount = refPdfFiles.filter(p => p.matched).length;
  const unmatchedRefPdfCount = refPdfFiles.filter(p => !p.matched).length;
  const foundPdfCount = importedRefs.filter(r => r.pdfAvailable && !r.pdfData).length;

  const processRefPdfs = useCallback(async (pdfFiles: File[]) => {
    const processedPdfs: RefPdfFile[] = [];
    for (const file of pdfFiles) {
      try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const [title, doi] = await Promise.all([
          extractPdfTitle(arrayBuffer.slice(0)),
          extractPdfDoi(arrayBuffer.slice(0)),
        ]);
        processedPdfs.push({
          id: crypto.randomUUID(),
          file,
          fileName: file.name,
          title: title || file.name.replace(/\.pdf$/i, ''),
          data: arrayBuffer,
          doi: doi || null,
          matched: false,
          matchedRefId: null,
        });
      } catch (error) {
        console.error('Error processing PDF:', file.name, error);
        try {
          const arrayBuffer = await readFileAsArrayBuffer(file);
          processedPdfs.push({
            id: crypto.randomUUID(),
            file,
            fileName: file.name,
            title: file.name.replace(/\.pdf$/i, ''),
            data: arrayBuffer,
            doi: null,
            matched: false,
            matchedRefId: null,
          });
        } catch (e) {
          console.error('Could not read PDF file:', file.name, e);
        }
      }
    }
    setRefPdfFiles(prev => [...prev, ...processedPdfs]);
  }, []);

  const lookupPdfsForRefs = useCallback(async (refs: ImportedRef[]) => {
    const refsWithDois = refs.filter(r => r.doi && !r.pdfData && !r.pdfUrl);
    if (refsWithDois.length === 0) return;

    setLookingUpRefPdfs(true);
    let foundCount = 0;

    try {
      const batchSize = 5;
      for (let i = 0; i < refsWithDois.length; i += batchSize) {
        const batch = refsWithDois.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async ref => {
            try {
              const pdfInfo = await checkPdfAvailability(ref.doi!);
              return { refId: ref._id, pdfInfo };
            } catch (error) {
              console.error('PDF lookup failed for', ref.doi, error);
              return { refId: ref._id, pdfInfo: null };
            }
          }),
        );

        setImportedRefs(prev =>
          prev.map(ref => {
            const result = results.find(r => r.refId === ref._id);
            if (result?.pdfInfo?.available) {
              foundCount++;
              return {
                ...ref,
                pdfUrl: result.pdfInfo.url,
                pdfSource: result.pdfInfo.source,
                pdfAccessible: result.pdfInfo.accessible,
                pdfAvailable: true,
              };
            }
            return ref;
          }),
        );

        if (i + batchSize < refsWithDois.length) {
          await new Promise<void>(resolve => setTimeout(resolve, 200));
        }
      }

      if (foundCount > 0) {
        showToast.success(
          'PDFs Found',
          `Found ${foundCount} open access PDF${foundCount > 1 ? 's' : ''} via Unpaywall.`,
        );
      }
    } catch (error) {
      console.error('Error looking up PDFs:', error);
    } finally {
      setLookingUpRefPdfs(false);
    }
  }, []);

  const handleRefFileSelect = useCallback(
    async (files: File[]) => {
      if (!files || files.length === 0) return;

      const { referenceFiles, pdfFiles } = separateFileTypes(files);

      if (referenceFiles.length === 0 && pdfFiles.length > 0 && importedRefs.length > 0) {
        await processRefPdfs(pdfFiles);
        return;
      }

      if (referenceFiles.length === 0) {
        showToast.warning(
          'No Reference File',
          'Please include a reference file (.ris, .bib, .enw, or .bibtex) along with your PDFs.',
        );
        return;
      }

      const file = referenceFiles[0];
      setRefFileName(file.name);
      setParsingRefs(true);

      try {
        const refs = await parseReferenceFile(file);
        if (refs.length === 0) {
          showToast.warning(
            'No References Found',
            'The file does not contain any valid references.',
          );
          setImportedRefs([]);
          setSelectedRefIds(new Set());
          setRefPdfFiles([]);
          return;
        }

        const refsWithIds: ImportedRef[] = (refs as Record<string, unknown>[]).map(
          (ref, index: number) => ({
            ...ref,
            _id: `ref-${index}`,
            title: (ref.title as string) || 'Untitled',
          }),
        ) as ImportedRef[];
        setImportedRefs(refsWithIds);
        setSelectedRefIds(new Set(refsWithIds.map(r => r._id)));

        if (pdfFiles.length > 0) {
          await processRefPdfs(pdfFiles);
        } else {
          setRefPdfFiles([]);
        }

        showToast.success(
          'References Parsed',
          `Found ${refs.length} reference${refs.length === 1 ? '' : 's'}.${pdfFiles.length > 0 ? ` Processing ${pdfFiles.length} PDF${pdfFiles.length > 1 ? 's' : ''}...` : ''}`,
        );

        lookupPdfsForRefs(refsWithIds);
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Parse Error' });
        setImportedRefs([]);
        setSelectedRefIds(new Set());
        setRefPdfFiles([]);
      } finally {
        setParsingRefs(false);
      }
    },
    [importedRefs, processRefPdfs, lookupPdfsForRefs],
  );

  const toggleRefSelection = useCallback((id: string) => {
    setSelectedRefIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllRefs = useCallback(() => {
    setSelectedRefIds(prev =>
      prev.size === importedRefs.length ? new Set() : new Set(importedRefs.map(r => r._id)),
    );
  }, [importedRefs]);

  const clearImportedRefs = useCallback(() => {
    setImportedRefs([]);
    setSelectedRefIds(new Set());
    setRefFileName('');
    setRefPdfFiles([]);
  }, []);

  const attachPdfToRef = useCallback((refId: string, pdfData: ArrayBuffer, pdfFileName: string) => {
    setImportedRefs(prev =>
      prev.map(ref => (ref._id === refId ? { ...ref, pdfData, pdfFileName } : ref)),
    );
  }, []);

  const markPdfMatched = useCallback((pdfId: string, refId: string) => {
    setRefPdfFiles(prev =>
      prev.map(p => (p.id === pdfId ? { ...p, matched: true, matchedRefId: refId } : p)),
    );
  }, []);

  const getSerializableState = useCallback(
    (): RefSerializableState => ({
      importedRefs: importedRefs.map(ref => ({
        _id: ref._id,
        title: ref.title,
        doi: ref.doi,
        firstAuthor: ref.firstAuthor,
        publicationYear: ref.publicationYear,
        authors: ref.authors ? [...ref.authors] : null,
        journal: ref.journal,
        abstract: ref.abstract,
        pdfUrl: ref.pdfUrl,
        pdfSource: ref.pdfSource,
        pdfAccessible: ref.pdfAccessible,
        pdfAvailable: ref.pdfAvailable,
        pdfData: cloneArrayBuffer(ref.pdfData),
        pdfFileName: ref.pdfFileName,
      })),
      selectedRefIds: Array.from(selectedRefIds),
      refFileName,
      refPdfFiles: refPdfFiles.map(pdf => ({
        id: pdf.id,
        fileName: pdf.fileName,
        title: pdf.title,
        data: cloneArrayBuffer(pdf.data),
        doi: pdf.doi,
        matched: pdf.matched,
        matchedRefId: pdf.matchedRefId,
        fileType: pdf.file?.type || null,
        fileSize: pdf.file?.size || null,
      })),
    }),
    [importedRefs, selectedRefIds, refFileName, refPdfFiles],
  );

  const restoreState = useCallback((savedState: RefRestorable) => {
    if (savedState.importedRefs && savedState.importedRefs.length > 0)
      setImportedRefs(savedState.importedRefs);
    if (savedState.selectedRefIds && savedState.selectedRefIds.length > 0)
      setSelectedRefIds(new Set(savedState.selectedRefIds));
    if (savedState.refFileName) setRefFileName(savedState.refFileName);
    if (savedState.refPdfFiles && savedState.refPdfFiles.length > 0) {
      setRefPdfFiles(
        savedState.refPdfFiles.map(pdf => ({
          id: pdf.id,
          fileName: pdf.fileName,
          title: pdf.title,
          data: pdf.data!,
          doi: pdf.doi,
          matched: pdf.matched,
          matchedRefId: pdf.matchedRefId,
          file:
            pdf.fileName ?
              {
                name: pdf.fileName,
                type: pdf.fileType || 'application/pdf',
                size: pdf.fileSize || pdf.data?.byteLength || 0,
              }
            : null,
        })),
      );
    }
  }, []);

  return {
    importedRefs,
    selectedRefIds,
    refFileName,
    parsingRefs,
    refPdfFiles,
    lookingUpRefPdfs,
    refCount,
    matchedRefPdfCount,
    unmatchedRefPdfCount,
    foundPdfCount,
    handleRefFileSelect,
    toggleRefSelection,
    toggleSelectAllRefs,
    clearImportedRefs,
    attachPdfToRef,
    markPdfMatched,
    getSerializableState,
    restoreState,
  };
}
