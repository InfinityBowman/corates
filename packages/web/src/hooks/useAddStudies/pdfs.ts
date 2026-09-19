/**
 * PDF upload operations for useAddStudies
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  extractPdfTitle,
  extractPdfDoi,
  readFileAsArrayBuffer,
  withTimeout,
} from '@/lib/pdfUtils.js';
import { fetchFromDOI } from '@/lib/referenceLookup.js';
import { cloneArrayBuffer } from './serialization';
import { validatePdfFile } from '@/lib/pdfValidation.js';
import { showToast } from '@/lib/toast';
import { preferPublishedTitle } from './matching';
import type { UploadedPdf, StudyMetadata } from './deduplication';

const DOI_FETCH_TIMEOUT = 10000;

interface SerializedPdf {
  id: string;
  title: string | null;
  extracting: boolean;
  data: ArrayBuffer | null;
  doi: string | null;
  metadata: StudyMetadata | null;
  matchedToRef: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
}

interface PdfOperations {
  uploadedPdfs: UploadedPdf[];
  pdfCount: number;
  handlePdfSelect: (files: File[]) => Promise<void>;
  retryPdfExtraction: (id: string) => Promise<void>;
  removePdf: (id: string) => void;
  updatePdfTitle: (id: string, newTitle: string) => void;
  markPdfMatched: (pdfId: string, refTitle: string) => void;
  clearPdfs: () => void;
  getSerializableState: () => SerializedPdf[];
  restoreState: (savedPdfs: SerializedPdf[] | null | undefined) => void;
}

export function usePdfOperations(): PdfOperations {
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const uploadedPdfsRef = useRef<UploadedPdf[]>(uploadedPdfs);
  useEffect(() => {
    uploadedPdfsRef.current = uploadedPdfs;
  }, [uploadedPdfs]);

  const pdfCount = uploadedPdfs.filter(p => p.title?.trim() && !p.extracting).length;

  const updatePdf = useCallback((id: string, updates: Partial<UploadedPdf>) => {
    setUploadedPdfs(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  /**
   * Fill the staged entry `id` from its file. A retry runs through here too, so it re-reads
   * the file rather than re-staging it (which the already-staged filter would then drop).
   */
  const extractInto = useCallback(
    async (id: string, file: File) => {
      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await readFileAsArrayBuffer(file);
      } catch (error) {
        console.error('Error reading PDF file:', file.name, error);
        updatePdf(id, {
          title: file.name.replace(/\.pdf$/i, ''),
          extracting: false,
          data: null,
          error: 'Failed to read file',
        });
        return;
      }

      let title: string | null = null;
      let doi: string | null = null;
      let extractionError: string | null = null;

      try {
        [title, doi] = await Promise.all([
          extractPdfTitle(arrayBuffer.slice(0)).catch((err: Error) => {
            console.warn('Title extraction failed:', file.name, err.message);
            return null;
          }),
          extractPdfDoi(arrayBuffer.slice(0)).catch((err: Error) => {
            console.warn('DOI extraction failed:', file.name, err.message);
            return null;
          }),
        ]);
      } catch (error) {
        console.error('Error extracting PDF metadata:', file.name, error);
        extractionError =
          (error as Error).message?.includes('timed out') ?
            'Extraction timed out'
          : 'Failed to extract metadata';
      }

      const extractedTitle = title || file.name.replace(/\.pdf$/i, '');
      updatePdf(id, {
        title: extractedTitle,
        extracting: false,
        data: arrayBuffer,
        doi: doi || null,
        error: extractionError,
        metadataLoading: !!doi,
      });

      if (!doi) return;

      try {
        const refData = await withTimeout(
          fetchFromDOI(doi),
          DOI_FETCH_TIMEOUT,
          'DOI metadata fetch',
        );
        if (!refData) {
          updatePdf(id, { metadataLoading: false });
          return;
        }
        updatePdf(id, {
          title: preferPublishedTitle(extractedTitle, refData.title),
          metadata: {
            firstAuthor: refData.firstAuthor || null,
            publicationYear: refData.publicationYear || null,
            // The lookup formats authors into one string, under a string[] type.
            authors: (refData.authors as unknown as string[]) || null,
            journal: refData.journal || null,
            abstract: refData.abstract || null,
          },
          metadataLoading: false,
        });
      } catch (err) {
        console.warn('Could not fetch metadata for DOI:', doi, (err as Error).message);
        updatePdf(id, { metadataLoading: false });
      }
    },
    [updatePdf],
  );

  const handlePdfSelect = useCallback(
    async (files: File[]) => {
      const validFiles: File[] = [];
      const invalidFiles: { file: File; message: string }[] = [];
      for (const file of files) {
        const validation = await validatePdfFile(file);
        if (validation.valid) {
          validFiles.push(file);
        } else {
          invalidFiles.push({ file, message: validation.details.message });
        }
      }

      if (invalidFiles.length > 0) {
        if (invalidFiles.length === 1) {
          const fileName = invalidFiles[0].file.name;
          const truncatedName = fileName.length > 50 ? fileName.slice(0, 47) + '...' : fileName;
          showToast.warning('Invalid PDF', `"${truncatedName}" - ${invalidFiles[0].message}`);
        } else {
          showToast.warning('Invalid PDFs', `${invalidFiles.length} files have invalid filenames.`);
        }
      }

      if (validFiles.length === 0) return;

      const existingFiles = new Set(
        uploadedPdfsRef.current
          .filter(pdf => pdf.file?.name)
          .map(pdf => `${pdf.file!.name}:${pdf.file!.size || 0}`),
      );
      const newFiles = validFiles.filter(
        file => !existingFiles.has(`${file.name}:${file.size || 0}`),
      );

      const alreadyStaged = validFiles.filter(file => !newFiles.includes(file));
      if (alreadyStaged.length > 0) {
        showToast.info(
          'Already staged',
          alreadyStaged.length === 1 ?
            `"${alreadyStaged[0].name}" is already in the list below.`
          : `${alreadyStaged.length} of these files are already in the list below.`,
        );
      }

      if (newFiles.length === 0) return;

      const newPdfs: UploadedPdf[] = newFiles.map(file => ({
        id: crypto.randomUUID(),
        file,
        title: null,
        extracting: true,
        data: null,
        doi: null,
        error: null,
        metadataLoading: false,
      }));

      setUploadedPdfs(prev => [...prev, ...newPdfs]);

      for (const pdf of newPdfs) {
        await extractInto(pdf.id, pdf.file as File);
      }
    },
    [extractInto],
  );

  const retryPdfExtraction = useCallback(
    async (id: string) => {
      const pdf = uploadedPdfsRef.current.find(p => p.id === id);
      if (!pdf || !pdf.file || !(pdf.file instanceof File)) return;

      updatePdf(id, {
        extracting: true,
        error: null,
        title: null,
        doi: null,
        metadata: null,
        metadataLoading: false,
      });

      await extractInto(id, pdf.file);
    },
    [updatePdf, extractInto],
  );

  const removePdf = useCallback((id: string) => {
    setUploadedPdfs(prev => prev.filter(p => p.id !== id));
  }, []);

  const updatePdfTitle = useCallback(
    (id: string, newTitle: string) => {
      updatePdf(id, { title: newTitle });
    },
    [updatePdf],
  );

  const markPdfMatched = useCallback(
    (pdfId: string, refTitle: string) => {
      updatePdf(pdfId, { matchedToRef: refTitle });
    },
    [updatePdf],
  );

  const clearPdfs = useCallback(() => {
    setUploadedPdfs([]);
  }, []);

  const getSerializableState = useCallback(
    (): SerializedPdf[] =>
      uploadedPdfs.map(pdf => ({
        id: pdf.id,
        title: pdf.title,
        extracting: pdf.extracting,
        data: cloneArrayBuffer(pdf.data),
        doi: pdf.doi || null,
        metadata: pdf.metadata ? { ...pdf.metadata } : null,
        matchedToRef: pdf.matchedToRef || null,
        fileName: pdf.file?.name || null,
        fileType: pdf.file?.type || null,
        fileSize: pdf.file?.size || null,
      })),
    [uploadedPdfs],
  );

  const restoreState = useCallback((savedPdfs: SerializedPdf[] | null | undefined) => {
    if (!savedPdfs?.length) return;
    setUploadedPdfs(
      savedPdfs.map(pdf => ({
        id: pdf.id,
        title: pdf.title,
        extracting: false,
        data: pdf.data,
        doi: pdf.doi,
        metadata: pdf.metadata,
        matchedToRef: pdf.matchedToRef,
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
  }, []);

  return {
    uploadedPdfs,
    pdfCount,
    handlePdfSelect,
    retryPdfExtraction,
    removePdf,
    updatePdfTitle,
    markPdfMatched,
    clearPdfs,
    getSerializableState,
    restoreState,
  };
}
