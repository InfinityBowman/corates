/**
 * Reference import operations for useAddStudies
 */

import { createSignal } from 'solid-js';
import { showToast } from '@/components/ui/toast';
import { extractPdfTitle, extractPdfDoi, readFileAsArrayBuffer } from '@/lib/pdfUtils.js';
import { parseReferenceFile, separateFileTypes } from '@/lib/referenceParser.js';
import { checkPdfAvailability } from '@/lib/referenceLookup.js';
import { cloneArrayBuffer } from './serialization.js';

/**
 * Create reference import operations
 * @returns {Object}
 */
export function createReferenceOperations() {
  const [importedRefs, setImportedRefs] = createSignal([]);
  const [selectedRefIds, setSelectedRefIds] = createSignal(new Set());
  const [refFileName, setRefFileName] = createSignal('');
  const [parsingRefs, setParsingRefs] = createSignal(false);
  const [refPdfFiles, setRefPdfFiles] = createSignal([]);
  const [lookingUpRefPdfs, setLookingUpRefPdfs] = createSignal(false);

  const refCount = () => selectedRefIds().size;
  const matchedRefPdfCount = () => refPdfFiles().filter(p => p.matched).length;
  const unmatchedRefPdfCount = () => refPdfFiles().filter(p => !p.matched).length;
  const foundPdfCount = () => importedRefs().filter(r => r.pdfAvailable && !r.pdfData).length;

  const processRefPdfs = async pdfFiles => {
    const processedPdfs = [];

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
  };

  const lookupPdfsForRefs = async refs => {
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
              const pdfInfo = await checkPdfAvailability(ref.doi);
              return { refId: ref._id, pdfInfo };
            } catch (error) {
              console.error('PDF lookup failed for', ref.doi, error);
              return { refId: ref._id, pdfInfo: null };
            }
          }),
        );

        setImportedRefs(prev => {
          const updated = prev.map(ref => {
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
          });
          return updated;
        });

        if (i + batchSize < refsWithDois.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
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
  };

  const handleRefFileSelect = async files => {
    if (!files || files.length === 0) return;

    const { referenceFiles, pdfFiles } = separateFileTypes(files);

    if (referenceFiles.length === 0 && pdfFiles.length > 0 && importedRefs().length > 0) {
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
        showToast.warning('No References Found', 'The file does not contain any valid references.');
        setImportedRefs([]);
        setSelectedRefIds(new Set());
        setRefPdfFiles([]);
        return;
      }

      const refsWithIds = refs.map((ref, index) => ({ ...ref, _id: `ref-${index}` }));
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
    } catch (error) {
      console.error('Error parsing reference file:', error);
      showToast.error('Parse Error', 'Failed to parse the reference file.');
      setImportedRefs([]);
      setSelectedRefIds(new Set());
      setRefPdfFiles([]);
    } finally {
      setParsingRefs(false);
    }
  };

  const toggleRefSelection = id => {
    setSelectedRefIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllRefs = () => {
    setSelectedRefIds(
      selectedRefIds().size === importedRefs().length ?
        new Set()
      : new Set(importedRefs().map(r => r._id)),
    );
  };

  const clearImportedRefs = () => {
    setImportedRefs([]);
    setSelectedRefIds(new Set());
    setRefFileName('');
    setRefPdfFiles([]);
  };

  // Used by matching effect to update ref with matched PDF
  const attachPdfToRef = (refId, pdfData, pdfFileName) => {
    setImportedRefs(prev =>
      prev.map(ref => (ref._id === refId ? { ...ref, pdfData, pdfFileName } : ref)),
    );
  };

  const markPdfMatched = (pdfId, refId) => {
    setRefPdfFiles(prev =>
      prev.map(p => (p.id === pdfId ? { ...p, matched: true, matchedRefId: refId } : p)),
    );
  };

  // Serialization
  const getSerializableState = () => ({
    importedRefs: importedRefs().map(ref => ({
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
    selectedRefIds: Array.from(selectedRefIds()),
    refFileName: refFileName(),
    refPdfFiles: refPdfFiles().map(pdf => ({
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
  });

  const restoreState = savedState => {
    if (savedState.importedRefs?.length > 0) {
      setImportedRefs(savedState.importedRefs);
    }
    if (savedState.selectedRefIds?.length > 0) {
      setSelectedRefIds(new Set(savedState.selectedRefIds));
    }
    if (savedState.refFileName) {
      setRefFileName(savedState.refFileName);
    }
    if (savedState.refPdfFiles?.length > 0) {
      const restoredRefPdfs = savedState.refPdfFiles.map(pdf => ({
        id: pdf.id,
        fileName: pdf.fileName,
        title: pdf.title,
        data: pdf.data,
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
      }));
      setRefPdfFiles(restoredRefPdfs);
    }
  };

  return {
    importedRefs,
    setImportedRefs,
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
