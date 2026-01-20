/**
 * PDF upload operations for useAddStudies
 */

import { createStore, produce, reconcile } from 'solid-js/store';
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

/**
 * Create PDF upload operations
 * @returns {Object}
 */
export function createPdfOperations() {
  const [uploadedPdfs, setUploadedPdfs] = createStore([]);

  const pdfCount = () => uploadedPdfs.filter(p => p.title?.trim() && !p.extracting).length;

  const handlePdfSelect = async files => {
    // Validate each file before processing
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

    // Show toast for invalid files
    if (invalidFiles.length > 0) {
      if (invalidFiles.length === 1) {
        const fileName = invalidFiles[0].file.name;
        const truncatedName = fileName.length > 50 ? fileName.slice(0, 47) + '...' : fileName;
        showToast.warning('Invalid PDF', `"${truncatedName}" - ${invalidFiles[0].message}`);
      } else {
        showToast.warning(
          'Invalid PDFs',
          `${invalidFiles.length} files have invalid filenames. Avoid special characters and keep under 200 characters.`,
        );
      }
    }

    if (validFiles.length === 0) return;

    // Filter out duplicates by name and size (handle null file objects from restored state)
    const existingFiles = new Set(
      uploadedPdfs
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

    setUploadedPdfs(produce(pdfs => pdfs.push(...newPdfs)));

    for (const pdf of newPdfs) {
      let arrayBuffer = null;
      let title = null;
      let doi = null;
      let extractionError = null;

      // Read file
      try {
        arrayBuffer = await readFileAsArrayBuffer(pdf.file);
      } catch (error) {
        console.error('Error reading PDF file:', pdf.file.name, error);
        setUploadedPdfs(p => p.id === pdf.id, {
          title: pdf.file.name.replace(/\.pdf$/i, ''),
          extracting: false,
          data: null,
          error: 'Failed to read file',
        });
        continue;
      }

      // Extract metadata
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

      // Update with extraction results
      setUploadedPdfs(p => p.id === pdf.id, {
        title: title || pdf.file.name.replace(/\.pdf$/i, ''),
        extracting: false,
        data: arrayBuffer,
        doi: doi || null,
        error: extractionError,
        metadataLoading: !!doi,
      });

      // Fetch DOI metadata in background
      if (doi) {
        withTimeout(fetchFromDOI(doi), DOI_FETCH_TIMEOUT, 'DOI metadata fetch')
          .then(refData => {
            if (refData) {
              setUploadedPdfs(p => p.id === pdf.id, {
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
              setUploadedPdfs(p => p.id === pdf.id, { metadataLoading: false });
            }
          })
          .catch(err => {
            console.warn('Could not fetch metadata for DOI:', doi, err.message);
            setUploadedPdfs(p => p.id === pdf.id, { metadataLoading: false });
          });
      }
    }
  };

  const retryPdfExtraction = async id => {
    const pdf = uploadedPdfs.find(p => p.id === id);
    if (!pdf || !pdf.file) return;

    setUploadedPdfs(p => p.id === id, {
      extracting: true,
      error: null,
      title: null,
      doi: null,
      metadata: null,
      metadataLoading: false,
    });

    await handlePdfSelect([pdf.file]);
    // Remove duplicate entry
    setUploadedPdfs(
      produce(pdfs => {
        const dupeIdx = pdfs.findIndex(p => p.id !== id && p.file === pdf.file);
        if (dupeIdx !== -1) {
          const dupe = pdfs[dupeIdx];
          const origIdx = pdfs.findIndex(p => p.id === id);
          if (origIdx !== -1) {
            Object.assign(pdfs[origIdx], {
              title: dupe.title,
              extracting: dupe.extracting,
              data: dupe.data,
              doi: dupe.doi,
              error: dupe.error,
              metadata: dupe.metadata,
              metadataLoading: dupe.metadataLoading,
            });
          }
          pdfs.splice(dupeIdx, 1);
        }
      }),
    );
  };

  const removePdf = id => {
    // Find the index and splice directly with produce for immediate reactivity
    setUploadedPdfs(
      produce(pdfs => {
        const idx = pdfs.findIndex(p => p.id === id);
        if (idx !== -1) {
          pdfs.splice(idx, 1);
        }
      }),
    );
  };

  const updatePdfTitle = (id, newTitle) => {
    setUploadedPdfs(p => p.id === id, 'title', newTitle);
  };

  const markPdfMatched = (pdfId, refTitle) => {
    setUploadedPdfs(p => p.id === pdfId, 'matchedToRef', refTitle);
  };

  const clearPdfs = () => {
    setUploadedPdfs(reconcile([]));
  };

  // Serialization helpers
  const getSerializableState = () =>
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
    }));

  const restoreState = savedPdfs => {
    if (!savedPdfs?.length) return;
    const restoredPdfs = savedPdfs.map(pdf => ({
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
    }));
    setUploadedPdfs(restoredPdfs);
  };

  return {
    uploadedPdfs,
    setUploadedPdfs,
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
