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
import { showToast } from '@/components/ui/toast';
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
        let arrayBuffer: ArrayBuffer | null = null;
        let title: string | null = null;
        let doi: string | null = null;
        let extractionError: string | null = null;

        try {
          arrayBuffer = await readFileAsArrayBuffer(pdf.file as File);
        } catch (error) {
          console.error('Error reading PDF file:', pdf.file!.name, error);
          updatePdf(pdf.id, {
            title: pdf.file!.name.replace(/\.pdf$/i, ''),
            extracting: false,
            data: null,
            error: 'Failed to read file',
          });
          continue;
        }

        try {
          [title, doi] = await Promise.all([
            extractPdfTitle(arrayBuffer.slice(0)).catch((err: Error) => {
              console.warn('Title extraction failed:', pdf.file!.name, err.message);
              return null;
            }),
            extractPdfDoi(arrayBuffer.slice(0)).catch((err: Error) => {
              console.warn('DOI extraction failed:', pdf.file!.name, err.message);
              return null;
            }),
          ]);
        } catch (error) {
          console.error('Error extracting PDF metadata:', pdf.file!.name, error);
          extractionError =
            (error as Error).message?.includes('timed out') ?
              'Extraction timed out'
            : 'Failed to extract metadata';
        }

        updatePdf(pdf.id, {
          title: title || pdf.file!.name.replace(/\.pdf$/i, ''),
          extracting: false,
          data: arrayBuffer,
          doi: doi || null,
          error: extractionError,
          metadataLoading: !!doi,
        });

        if (doi) {
          withTimeout(fetchFromDOI(doi), DOI_FETCH_TIMEOUT, 'DOI metadata fetch')
            .then((result: unknown) => {
              const refData = result as Record<string, unknown> | null;
              if (refData) {
                updatePdf(pdf.id, {
                  metadata: {
                    firstAuthor: (refData.firstAuthor as string) || null,
                    publicationYear: (refData.publicationYear as number) || null,
                    authors: (refData.authors as string[]) || null,
                    journal: (refData.journal as string) || null,
                    abstract: (refData.abstract as string) || null,
                  },
                  metadataLoading: false,
                });
              } else {
                updatePdf(pdf.id, { metadataLoading: false });
              }
            })
            .catch((err: Error) => {
              console.warn('Could not fetch metadata for DOI:', doi, err.message);
              updatePdf(pdf.id, { metadataLoading: false });
            });
        }
      }
    },
    [updatePdf],
  );

  const retryPdfExtraction = useCallback(
    async (id: string) => {
      const pdf = uploadedPdfs.find(p => p.id === id);
      if (!pdf || !pdf.file || !(pdf.file instanceof File)) return;

      updatePdf(id, {
        extracting: true,
        error: null,
        title: null,
        doi: null,
        metadata: null,
        metadataLoading: false,
      });

      // Re-process the file
      await handlePdfSelect([pdf.file]);
      // Remove the original entry (handlePdfSelect created a new one)
      setUploadedPdfs(prev => {
        const dupeIdx = prev.findIndex(p => p.id !== id && p.file === pdf.file);
        if (dupeIdx === -1) return prev;
        const dupe = prev[dupeIdx];
        return prev
          .map(p => (p.id === id ? { ...p, ...dupe, id } : p))
          .filter(p => p.id !== dupe.id);
      });
    },
    [uploadedPdfs, updatePdf, handlePdfSelect],
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
