/**
 * PDF upload operations for useAddStudies (React version)
 *
 * Uses useState with immutable updates instead of SolidJS createStore/produce.
 */

import { useState, useCallback, useRef } from 'react';
import {
  extractPdfTitle,
  extractPdfDoi,
  readFileAsArrayBuffer,
  withTimeout,
} from '@/lib/pdfUtils.js';
import { fetchFromDOI } from '@/lib/referenceLookup.js';
import { cloneArrayBuffer } from './serialization.js';
import { validatePdfFile } from '@/lib/pdfValidation.js';
import { showToast } from '@/components/ui/toast';

const DOI_FETCH_TIMEOUT = 10000;

export function usePdfOperations() {
  const [uploadedPdfs, setUploadedPdfs] = useState([]);
  const uploadedPdfsRef = useRef(uploadedPdfs);
  uploadedPdfsRef.current = uploadedPdfs;

  const pdfCount = uploadedPdfs.filter(p => p.title?.trim() && !p.extracting).length;

  const updatePdf = useCallback((id, updates) => {
    setUploadedPdfs(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const handlePdfSelect = useCallback(
    async files => {
      const validFiles = [];
      const invalidFiles = [];
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
          .map(pdf => `${pdf.file.name}:${pdf.file.size || 0}`),
      );
      const newFiles = validFiles.filter(
        file => !existingFiles.has(`${file.name}:${file.size || 0}`),
      );

      if (newFiles.length === 0) return;

      const newPdfs = newFiles.map(file => ({
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
        let arrayBuffer = null;
        let title = null;
        let doi = null;
        let extractionError = null;

        try {
          arrayBuffer = await readFileAsArrayBuffer(pdf.file);
        } catch (error) {
          console.error('Error reading PDF file:', pdf.file.name, error);
          updatePdf(pdf.id, {
            title: pdf.file.name.replace(/\.pdf$/i, ''),
            extracting: false,
            data: null,
            error: 'Failed to read file',
          });
          continue;
        }

        try {
          [title, doi] = await Promise.all([
            extractPdfTitle(arrayBuffer.slice(0)).catch(err => {
              console.warn('Title extraction failed:', pdf.file.name, err.message);
              return null;
            }),
            extractPdfDoi(arrayBuffer.slice(0)).catch(err => {
              console.warn('DOI extraction failed:', pdf.file.name, err.message);
              return null;
            }),
          ]);
        } catch (error) {
          console.error('Error extracting PDF metadata:', pdf.file.name, error);
          extractionError =
            error.message?.includes('timed out') ?
              'Extraction timed out'
            : 'Failed to extract metadata';
        }

        updatePdf(pdf.id, {
          title: title || pdf.file.name.replace(/\.pdf$/i, ''),
          extracting: false,
          data: arrayBuffer,
          doi: doi || null,
          error: extractionError,
          metadataLoading: !!doi,
        });

        if (doi) {
          withTimeout(fetchFromDOI(doi), DOI_FETCH_TIMEOUT, 'DOI metadata fetch')
            .then(refData => {
              if (refData) {
                updatePdf(pdf.id, {
                  metadata: {
                    firstAuthor: refData.firstAuthor || null,
                    publicationYear: refData.publicationYear || null,
                    authors: refData.authors || null,
                    journal: refData.journal || null,
                    abstract: refData.abstract || null,
                  },
                  metadataLoading: false,
                });
              } else {
                updatePdf(pdf.id, { metadataLoading: false });
              }
            })
            .catch(err => {
              console.warn('Could not fetch metadata for DOI:', doi, err.message);
              updatePdf(pdf.id, { metadataLoading: false });
            });
        }
      }
    },
    [updatePdf],
  );

  const retryPdfExtraction = useCallback(
    async id => {
      const pdf = uploadedPdfs.find(p => p.id === id);
      if (!pdf || !pdf.file) return;

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

  const removePdf = useCallback(id => {
    setUploadedPdfs(prev => prev.filter(p => p.id !== id));
  }, []);

  const updatePdfTitle = useCallback(
    (id, newTitle) => {
      updatePdf(id, { title: newTitle });
    },
    [updatePdf],
  );

  const markPdfMatched = useCallback(
    (pdfId, refTitle) => {
      updatePdf(pdfId, { matchedToRef: refTitle });
    },
    [updatePdf],
  );

  const clearPdfs = useCallback(() => {
    setUploadedPdfs([]);
  }, []);

  const getSerializableState = useCallback(
    () =>
      uploadedPdfs.map(pdf => ({
        id: pdf.id,
        title: pdf.title,
        extracting: pdf.extracting,
        data: cloneArrayBuffer(pdf.data),
        doi: pdf.doi,
        metadata: pdf.metadata ? { ...pdf.metadata } : null,
        matchedToRef: pdf.matchedToRef,
        fileName: pdf.file?.name || null,
        fileType: pdf.file?.type || null,
        fileSize: pdf.file?.size || null,
      })),
    [uploadedPdfs],
  );

  const restoreState = useCallback(savedPdfs => {
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
