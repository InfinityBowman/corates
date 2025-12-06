/**
 * useAddStudies - State management hook for AddStudiesForm
 * Manages PDF uploads, reference imports, DOI/PMID lookups, and Google Drive files
 */

import { createSignal, createMemo, createEffect } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { showToast } from '@components/zag/Toast.jsx';
import {
  extractPdfTitle,
  extractPdfDoi,
  normalizeTitle,
  readFileAsArrayBuffer,
} from '@/lib/pdfUtils.js';
import { parseReferenceFile, separateFileTypes } from '@/lib/referenceParser.js';
import {
  fetchReferenceByIdentifier,
  parseIdentifiers,
  checkPdfAvailability,
  fetchFromDOI,
} from '@/lib/referenceLookup.js';

/**
 * @param {Object} options
 * @param {boolean} [options.collectMode] - If true, calls onStudiesChange with raw data
 * @param {Function} [options.onStudiesChange] - Called with collected data in collectMode
 */
export function useAddStudies(options = {}) {
  // PDF upload state
  const [uploadedPdfs, setUploadedPdfs] = createStore([]);

  // Reference import state
  const [importedRefs, setImportedRefs] = createSignal([]);
  const [selectedRefIds, setSelectedRefIds] = createSignal(new Set());
  const [refFileName, setRefFileName] = createSignal('');
  const [parsingRefs, setParsingRefs] = createSignal(false);
  const [refPdfFiles, setRefPdfFiles] = createSignal([]);
  const [lookingUpRefPdfs, setLookingUpRefPdfs] = createSignal(false);

  // DOI/PMID lookup state
  const [identifierInput, setIdentifierInput] = createSignal('');
  const [lookupRefs, setLookupRefs] = createSignal([]);
  const [selectedLookupIds, setSelectedLookupIds] = createSignal(new Set());
  const [lookingUp, setLookingUp] = createSignal(false);
  const [lookupErrors, setLookupErrors] = createSignal([]);

  // Google Drive state
  const [selectedDriveFiles, setSelectedDriveFiles] = createSignal([]);

  // Computed values
  const pdfCount = () => uploadedPdfs.filter(p => p.title?.trim() && !p.extracting).length;
  const refCount = () => selectedRefIds().size;
  const lookupCount = () => selectedLookupIds().size;
  const driveCount = () => selectedDriveFiles().length;

  const totalStudyCount = createMemo(() => {
    return pdfCount() + refCount() + lookupCount() + driveCount();
  });

  const hasAnyStudies = () => {
    return (
      uploadedPdfs.length > 0 ||
      selectedRefIds().size > 0 ||
      selectedLookupIds().size > 0 ||
      selectedDriveFiles().length > 0
    );
  };

  const matchedRefPdfCount = () => refPdfFiles().filter(p => p.matched).length;
  const unmatchedRefPdfCount = () => refPdfFiles().filter(p => !p.matched).length;
  const foundPdfCount = () => importedRefs().filter(r => r.pdfAvailable && !r.pdfData).length;

  // Helper to check collectMode (can be function or value)
  const isCollectMode = () =>
    typeof options.collectMode === 'function' ? options.collectMode() : options.collectMode;

  // Collect mode effect - notify parent of study changes
  createEffect(() => {
    if (!isCollectMode() || !options.onStudiesChange) return;

    const pdfs = uploadedPdfs
      .filter(p => p.title?.trim() && !p.extracting && p.data)
      .map(p => ({
        title: p.title,
        fileName: p.file.name,
        data: p.data,
        doi: p.doi || null,
        metadata: p.metadata || null,
      }));

    const selectedIds = selectedRefIds();
    const refs = importedRefs()
      .filter(r => selectedIds.has(r._id))
      .map(({ _id, ...ref }) => ({
        title: ref.title,
        pdfData: ref.pdfData || null,
        pdfFileName: ref.pdfFileName || null,
        metadata: {
          firstAuthor: ref.firstAuthor,
          publicationYear: ref.publicationYear,
          authors: ref.authors,
          journal: ref.journal,
          doi: ref.doi,
          abstract: ref.abstract,
          pdfUrl: ref.pdfUrl || null,
          pdfSource: ref.pdfSource || null,
          pdfAccessible: ref.pdfAccessible || false,
          importSource: 'reference-file',
        },
      }));

    const selectedLookups = selectedLookupIds();
    const lookups = lookupRefs()
      .filter(r => selectedLookups.has(r._id) && r.pdfAvailable)
      .map(({ _id, ...ref }) => ({
        title: ref.title,
        pdfData: ref.manualPdfData || null,
        pdfFileName: ref.manualPdfFileName || null,
        metadata: {
          firstAuthor: ref.firstAuthor,
          publicationYear: ref.publicationYear,
          authors: ref.authors,
          journal: ref.journal,
          doi: ref.doi,
          abstract: ref.abstract,
          pdfUrl: ref.pdfUrl,
          pdfSource: ref.pdfSource,
          pdfAccessible: ref.pdfAccessible,
          importSource: ref.importSource || 'doi-lookup',
        },
      }));

    const driveFiles = selectedDriveFiles().map(file => ({
      id: file.id,
      name: file.name,
      size: file.size,
      importSource: 'google-drive',
    }));

    options.onStudiesChange({ pdfs, refs, lookups, driveFiles });
  });

  // ===================
  // PDF Handlers
  // ===================

  const handlePdfSelect = async files => {
    console.log('Selected PDF files:', files);
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    const newPdfs = pdfFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      title: null,
      extracting: true,
      data: null,
      doi: null,
    }));

    setUploadedPdfs(produce(pdfs => pdfs.push(...newPdfs)));

    for (const pdf of newPdfs) {
      try {
        const arrayBuffer = await readFileAsArrayBuffer(pdf.file);
        const [title, doi] = await Promise.all([
          extractPdfTitle(arrayBuffer.slice(0)),
          extractPdfDoi(arrayBuffer.slice(0)),
        ]);
        console.log('Extracted PDF metadata:', { title, doi });
        
        // If DOI was extracted, fetch author/year metadata
        let metadata = null;
        if (doi) {
          try {
            console.log('Fetching metadata for DOI:', doi);
            const refData = await fetchFromDOI(doi);
            metadata = {
              firstAuthor: refData.firstAuthor || null,
              publicationYear: refData.publicationYear || null,
              authors: refData.authors || null,
              journal: refData.journal || null,
              abstract: refData.abstract || null,
            };
            console.log('Fetched metadata:', metadata);
          } catch (err) {
            console.warn('Could not fetch metadata for DOI:', doi, err);
          }
        }
        
        setUploadedPdfs(p => p.id === pdf.id, {
          title: title || pdf.file.name.replace(/\.pdf$/i, ''),
          extracting: false,
          data: arrayBuffer,
          doi: doi || null,
          metadata: metadata,
        });
      } catch (error) {
        console.error('Error extracting PDF metadata:', error);
        let fileData = null;
        try {
          fileData = await readFileAsArrayBuffer(pdf.file);
        } catch (e) {
          console.error('Error reading PDF file:', e);
        }
        setUploadedPdfs(p => p.id === pdf.id, {
          title: pdf.file.name.replace(/\.pdf$/i, ''),
          extracting: false,
          data: fileData,
          doi: null,
          metadata: null,
        });
      }
    }
  };

  const removePdf = id => {
    setUploadedPdfs(
      produce(pdfs => {
        const idx = pdfs.findIndex(p => p.id === id);
        if (idx !== -1) pdfs.splice(idx, 1);
      }),
    );
  };

  const updatePdfTitle = (id, newTitle) => {
    setUploadedPdfs(p => p.id === id, 'title', newTitle);
  };

  // Effect to match uploaded PDFs with lookup refs that need PDFs
  createEffect(() => {
    const pdfs = uploadedPdfs.filter(p => !p.extracting && p.data);
    const refs = lookupRefs();

    if (pdfs.length === 0 || refs.length === 0) return;

    const refsNeedingPdf = refs.filter(
      r => !r.manualPdfData && (!r.pdfAvailable || !r.pdfAccessible),
    );
    if (refsNeedingPdf.length === 0) return;

    let matchCount = 0;

    for (const ref of refsNeedingPdf) {
      const refDoi = ref.doi
        ?.toLowerCase()
        .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
        .trim();
      const refTitleNorm = normalizeTitle(ref.title);

      for (const pdf of pdfs) {
        if (refDoi && pdf.doi && refDoi === pdf.doi) {
          console.log('DOI match found:', refDoi, '=', pdf.doi);
          setLookupRefs(prev =>
            prev.map(r =>
              r._id === ref._id ?
                {
                  ...r,
                  pdfAvailable: true,
                  manualPdfData: pdf.data,
                  manualPdfFileName: pdf.file?.name || 'matched.pdf',
                  matchedFromUpload: true,
                }
              : r,
            ),
          );
          setUploadedPdfs(p => p.id === pdf.id, 'matchedToRef', ref.title || 'DOI reference');
          setSelectedLookupIds(prev => {
            const next = new Set(prev);
            next.add(ref._id);
            return next;
          });
          matchCount++;
          break;
        }

        const pdfTitleNorm = normalizeTitle(pdf.title);
        if (refTitleNorm && pdfTitleNorm && refTitleNorm === pdfTitleNorm) {
          console.log('Title match found:', refTitleNorm);
          setLookupRefs(prev =>
            prev.map(r =>
              r._id === ref._id ?
                {
                  ...r,
                  pdfAvailable: true,
                  manualPdfData: pdf.data,
                  manualPdfFileName: pdf.file?.name || 'matched.pdf',
                  matchedFromUpload: true,
                }
              : r,
            ),
          );
          setUploadedPdfs(p => p.id === pdf.id, 'matchedToRef', ref.title || 'Title reference');
          setSelectedLookupIds(prev => {
            const next = new Set(prev);
            next.add(ref._id);
            return next;
          });
          matchCount++;
          break;
        }
      }
    }

    if (matchCount > 0) {
      showToast.success(
        'PDFs Matched',
        `Automatically matched ${matchCount} uploaded PDF${matchCount > 1 ? 's' : ''} with DOI/PMID references.`,
      );
    }
  });

  // ===================
  // Reference Import Handlers
  // ===================

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

  // Effect to match PDFs with imported references
  createEffect(() => {
    const pdfs = refPdfFiles();
    const refs = importedRefs();

    if (pdfs.length === 0 || refs.length === 0) return;

    const unmatchedPdfs = pdfs.filter(p => !p.matched);
    if (unmatchedPdfs.length === 0) return;

    let matchCount = 0;
    const updatedPdfs = [...pdfs];
    const updatedRefs = refs.map(ref => ({ ...ref }));

    for (const pdf of unmatchedPdfs) {
      const pdfDoi = pdf.doi?.toLowerCase().trim();
      const pdfTitleNorm = normalizeTitle(pdf.title);

      for (let i = 0; i < updatedRefs.length; i++) {
        const ref = updatedRefs[i];
        if (ref.pdfData) continue;

        const refDoi = ref.doi
          ?.toLowerCase()
          .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
          .trim();
        const refTitleNorm = normalizeTitle(ref.title);

        let isMatch = false;

        if (pdfDoi && refDoi && pdfDoi === refDoi) {
          console.log('Ref import: DOI match found:', pdfDoi);
          isMatch = true;
        } else if (pdfTitleNorm && refTitleNorm && pdfTitleNorm === refTitleNorm) {
          console.log('Ref import: Title match found:', pdfTitleNorm);
          isMatch = true;
        }

        if (isMatch) {
          updatedRefs[i] = {
            ...ref,
            pdfData: pdf.data,
            pdfFileName: pdf.fileName,
          };

          const pdfIdx = updatedPdfs.findIndex(p => p.id === pdf.id);
          if (pdfIdx !== -1) {
            updatedPdfs[pdfIdx] = { ...updatedPdfs[pdfIdx], matched: true, matchedRefId: ref._id };
          }

          matchCount++;
          break;
        }
      }
    }

    if (matchCount > 0) {
      setImportedRefs(updatedRefs);
      setRefPdfFiles(updatedPdfs);
      showToast.success(
        'PDFs Matched',
        `Automatically matched ${matchCount} PDF${matchCount > 1 ? 's' : ''} with imported references.`,
      );
    }
  });

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

  // ===================
  // DOI/PMID Lookup Handlers
  // ===================

  const handleLookup = async () => {
    const input = identifierInput().trim();
    if (!input) return;

    const identifiers = parseIdentifiers(input);
    if (identifiers.length === 0) {
      showToast.warning('No Identifiers', 'Could not find any valid DOIs or PMIDs in the input.');
      return;
    }

    setLookingUp(true);
    setLookupErrors([]);

    try {
      const newRefs = [];
      const errors = [];

      for (const id of identifiers) {
        try {
          const ref = await fetchReferenceByIdentifier(id);
          if (ref) {
            newRefs.push({ ...ref, _id: `lookup-${crypto.randomUUID()}` });
          }
        } catch (error) {
          errors.push({ identifier: id, error: error.message || 'Lookup failed' });
        }
      }

      if (newRefs.length > 0) {
        setLookupRefs(prev => [...prev, ...newRefs]);
        setSelectedLookupIds(prev => {
          const next = new Set(prev);
          newRefs.filter(r => r.pdfAvailable).forEach(r => next.add(r._id));
          return next;
        });
        setIdentifierInput('');
      }

      if (errors.length > 0) setLookupErrors(errors);
    } catch (error) {
      console.error('Lookup error:', error);
      showToast.error('Lookup Failed', 'An error occurred during lookup.');
    } finally {
      setLookingUp(false);
    }
  };

  const toggleLookupSelection = id => {
    const ref = lookupRefs().find(r => r._id === id);
    if (!ref?.pdfAvailable) return;

    setSelectedLookupIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllLookup = () => {
    const refsWithPdf = lookupRefs().filter(r => r.pdfAvailable);
    setSelectedLookupIds(
      selectedLookupIds().size === refsWithPdf.length ?
        new Set()
      : new Set(refsWithPdf.map(r => r._id)),
    );
  };

  const removeLookupRef = id => {
    setLookupRefs(prev => prev.filter(r => r._id !== id));
    setSelectedLookupIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const clearLookupRefs = () => {
    setLookupRefs([]);
    setSelectedLookupIds(new Set());
    setLookupErrors([]);
  };

  const attachPdfToLookupRef = (refId, fileName, arrayBuffer) => {
    setLookupRefs(prev =>
      prev.map(ref =>
        ref._id === refId ?
          { ...ref, manualPdfData: arrayBuffer, manualPdfFileName: fileName }
        : ref,
      ),
    );
  };

  // ===================
  // Google Drive Handlers
  // ===================

  const toggleDriveFile = file => {
    setSelectedDriveFiles(prev => {
      const exists = prev.some(f => f.id === file.id);
      if (exists) {
        return prev.filter(f => f.id !== file.id);
      } else {
        return [...prev, file];
      }
    });
  };

  const removeDriveFile = fileId => {
    setSelectedDriveFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearDriveFiles = () => {
    setSelectedDriveFiles([]);
  };

  // ===================
  // Submit/Clear
  // ===================

  /**
   * Builds deduplicated studies to submit by merging entries that match by DOI or title.
   * Priority: metadata from refs/lookups, PDF data from uploads.
   */
  const getStudiesToSubmit = () => {
    // Collect all study candidates with their source type
    const candidates = [];

    // Add uploaded PDFs
    for (const pdf of uploadedPdfs) {
      if (pdf.title?.trim() && !pdf.extracting) {
        candidates.push({
          type: 'pdf',
          title: pdf.title.trim(),
          doi: pdf.doi || null,
          pdfData: pdf.data,
          pdfFileName: pdf.file?.name || null,
          metadata: pdf.metadata || null,
        });
      }
    }

    // Add selected imported refs
    const selectedRefs = importedRefs().filter(r => selectedRefIds().has(r._id));
    for (const ref of selectedRefs) {
      candidates.push({
        type: 'ref',
        title: ref.title,
        doi: ref.doi || null,
        pdfData: ref.pdfData || null,
        pdfFileName: ref.pdfFileName || null,
        pdfUrl: ref.pdfUrl || null,
        pdfSource: ref.pdfSource || null,
        pdfAccessible: ref.pdfAccessible || false,
        metadata: {
          firstAuthor: ref.firstAuthor,
          publicationYear: ref.publicationYear,
          authors: ref.authors,
          journal: ref.journal,
          abstract: ref.abstract,
        },
      });
    }

    // Add selected DOI/PMID lookups (only those with PDF available)
    const selectedLookups = lookupRefs().filter(
      r => selectedLookupIds().has(r._id) && r.pdfAvailable,
    );
    for (const ref of selectedLookups) {
      candidates.push({
        type: 'lookup',
        title: ref.title,
        doi: ref.doi || null,
        pdfData: ref.manualPdfData || null,
        pdfFileName: ref.manualPdfFileName || null,
        pdfUrl: ref.pdfUrl || null,
        pdfSource: ref.pdfSource || null,
        pdfAccessible: ref.pdfAccessible || false,
        metadata: {
          firstAuthor: ref.firstAuthor,
          publicationYear: ref.publicationYear,
          authors: ref.authors,
          journal: ref.journal,
          abstract: ref.abstract,
        },
      });
    }

    // Add Google Drive files
    for (const file of selectedDriveFiles()) {
      candidates.push({
        type: 'drive',
        title: file.name.replace(/\.pdf$/i, ''),
        doi: null,
        googleDriveFileId: file.id,
        googleDriveFileName: file.name,
        metadata: null,
      });
    }

    // Deduplicate by DOI or normalized title
    const merged = [];
    const usedIndices = new Set();

    for (let i = 0; i < candidates.length; i++) {
      if (usedIndices.has(i)) continue;

      const base = candidates[i];
      const baseDoi = base.doi
        ?.toLowerCase()
        .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
        .trim();
      const baseTitleNorm = normalizeTitle(base.title);

      // Find all matching candidates
      const matches = [base];
      usedIndices.add(i);

      for (let j = i + 1; j < candidates.length; j++) {
        if (usedIndices.has(j)) continue;

        const other = candidates[j];
        const otherDoi = other.doi
          ?.toLowerCase()
          .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
          .trim();
        const otherTitleNorm = normalizeTitle(other.title);

        let isMatch = false;

        // Match by DOI (if both have DOI)
        if (baseDoi && otherDoi && baseDoi === otherDoi) {
          isMatch = true;
        }
        // Match by normalized title
        else if (baseTitleNorm && otherTitleNorm && baseTitleNorm === otherTitleNorm) {
          isMatch = true;
        }

        if (isMatch) {
          matches.push(other);
          usedIndices.add(j);
        }
      }

      // Merge all matches into one study
      // Priority: metadata from ref/lookup, PDF data from any source that has it
      const mergedStudy = {
        title: base.title,
        doi: null,
        pdfData: null,
        pdfFileName: null,
        pdfUrl: null,
        pdfSource: null,
        pdfAccessible: false,
        googleDriveFileId: null,
        googleDriveFileName: null,
        firstAuthor: null,
        publicationYear: null,
        authors: null,
        journal: null,
        abstract: null,
        importSource:
          base.type === 'pdf' ? 'pdf'
          : base.type === 'drive' ? 'google-drive'
          : base.type === 'ref' ? 'reference-file'
          : 'identifier-lookup',
      };

      // Merge data from all matches
      for (const match of matches) {
        // Prefer richer title (from metadata sources)
        if (match.metadata && match.title) {
          mergedStudy.title = match.title;
        }

        // Take DOI from any source
        if (match.doi && !mergedStudy.doi) {
          mergedStudy.doi = match.doi;
        }

        // Take PDF data from any source
        if (match.pdfData && !mergedStudy.pdfData) {
          mergedStudy.pdfData = match.pdfData;
          mergedStudy.pdfFileName = match.pdfFileName;
        }

        // Take PDF URL if no direct data
        if (match.pdfUrl && !mergedStudy.pdfUrl) {
          mergedStudy.pdfUrl = match.pdfUrl;
          mergedStudy.pdfSource = match.pdfSource;
          mergedStudy.pdfAccessible = match.pdfAccessible;
        }

        // Take Google Drive info
        if (match.googleDriveFileId) {
          mergedStudy.googleDriveFileId = match.googleDriveFileId;
          mergedStudy.googleDriveFileName = match.googleDriveFileName;
        }

        // Merge metadata from refs/lookups
        if (match.metadata) {
          if (match.metadata.firstAuthor) mergedStudy.firstAuthor = match.metadata.firstAuthor;
          if (match.metadata.publicationYear)
            mergedStudy.publicationYear = match.metadata.publicationYear;
          if (match.metadata.authors) mergedStudy.authors = match.metadata.authors;
          if (match.metadata.journal) mergedStudy.journal = match.metadata.journal;
          if (match.metadata.abstract) mergedStudy.abstract = match.metadata.abstract;

          // Update import source to reflect we have metadata
          if (match.type === 'ref') mergedStudy.importSource = 'reference-file';
          else if (match.type === 'lookup') mergedStudy.importSource = 'identifier-lookup';
        }
      }

      // If we merged multiple sources, note it
      if (matches.length > 1) {
        const types = [...new Set(matches.map(m => m.type))];
        if (types.length > 1) {
          mergedStudy.importSource = 'merged';
        }
      }

      merged.push(mergedStudy);
    }

    return merged;
  };

  const clearAll = () => {
    setUploadedPdfs([]);
    clearImportedRefs();
    clearLookupRefs();
    clearDriveFiles();
  };

  return {
    // PDF state & handlers
    uploadedPdfs,
    handlePdfSelect,
    removePdf,
    updatePdfTitle,

    // Reference import state & handlers
    importedRefs,
    selectedRefIds,
    refFileName,
    parsingRefs,
    lookingUpRefPdfs,
    handleRefFileSelect,
    toggleRefSelection,
    toggleSelectAllRefs,
    clearImportedRefs,
    matchedRefPdfCount,
    unmatchedRefPdfCount,
    foundPdfCount,

    // DOI/PMID lookup state & handlers
    identifierInput,
    setIdentifierInput,
    lookupRefs,
    selectedLookupIds,
    lookingUp,
    lookupErrors,
    handleLookup,
    toggleLookupSelection,
    toggleSelectAllLookup,
    removeLookupRef,
    clearLookupRefs,
    attachPdfToLookupRef,

    // Google Drive state & handlers
    selectedDriveFiles,
    toggleDriveFile,
    removeDriveFile,
    clearDriveFiles,

    // Computed values
    pdfCount,
    refCount,
    lookupCount,
    driveCount,
    totalStudyCount,
    hasAnyStudies,

    // Submit helpers
    getStudiesToSubmit,
    clearAll,
  };
}
