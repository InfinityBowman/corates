/**
 * AddStudiesForm - Unified component for adding studies to a project
 * Supports four methods: PDF uploads, reference file imports, DOI/PMID lookups, and Google Drive
 * Can be used both during project creation and when adding studies to existing projects
 */

import { createSignal, Show, createMemo, createEffect, onMount, onCleanup } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { BiRegularPlus } from 'solid-icons/bi';
import { AiOutlineCloudUpload } from 'solid-icons/ai';
import { FiChevronUp } from 'solid-icons/fi';
import { Tabs } from '@components/zag/Tabs.jsx';
import { showToast } from '@components/zag/Toast.jsx';
import { extractPdfTitle, readFileAsArrayBuffer } from '@/lib/pdfUtils.js';
import { parseReferenceFile } from '@/lib/referenceParser.js';
import { fetchReferenceByIdentifier, parseIdentifiers } from '@/lib/referenceLookup.js';

import PdfUploadSection from './add-studies/PdfUploadSection.jsx';
import ReferenceImportSection from './add-studies/ReferenceImportSection.jsx';
import DoiLookupSection from './add-studies/DoiLookupSection.jsx';
import GoogleDriveSection from './add-studies/GoogleDriveSection.jsx';

/**
 * @param {Object} props
 * @param {Function} [props.onAddStudies] - Called with studies to add: (studies: Array) => void (not used in collectMode)
 * @param {boolean} [props.loading] - Whether the form is in a loading/submitting state
 * @param {boolean} [props.expanded] - Control expanded state externally (optional)
 * @param {Function} [props.onExpand] - Called when form expands
 * @param {Function} [props.onCollapse] - Called when form collapses
 * @param {boolean} [props.hasExistingStudies] - Whether the project already has studies
 * @param {boolean} [props.alwaysExpanded] - If true, the form is always shown expanded
 * @param {boolean} [props.compact] - Use more compact styling
 * @param {boolean} [props.collectMode] - If true, hides submit button and calls onStudiesChange with raw data
 * @param {Function} [props.onStudiesChange] - Called with collected data in collectMode: ({ pdfs, refs, lookups }) => void
 * @param {boolean} [props.hideTitle] - If true, hides the "Add Studies" header
 */
export default function AddStudiesForm(props) {
  const [internalExpanded, setInternalExpanded] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal('pdfs');
  const [isDraggingOver, setIsDraggingOver] = createSignal(false);
  let containerRef;

  // PDF upload state
  const [uploadedPdfs, setUploadedPdfs] = createStore([]);

  // Reference import state
  const [importedRefs, setImportedRefs] = createSignal([]);
  const [selectedRefIds, setSelectedRefIds] = createSignal(new Set());
  const [refFileName, setRefFileName] = createSignal('');
  const [parsingRefs, setParsingRefs] = createSignal(false);

  // DOI/PMID lookup state
  const [identifierInput, setIdentifierInput] = createSignal('');
  const [lookupRefs, setLookupRefs] = createSignal([]);
  const [selectedLookupIds, setSelectedLookupIds] = createSignal(new Set());
  const [lookingUp, setLookingUp] = createSignal(false);
  const [lookupErrors, setLookupErrors] = createSignal([]);

  // Google Drive state
  const [selectedDriveFiles, setSelectedDriveFiles] = createSignal([]);

  const isExpanded = () => {
    if (props.alwaysExpanded) return true;
    if (props.expanded !== undefined) return props.expanded;
    return internalExpanded() || hasAnyStudies();
  };

  const hasAnyStudies = () => {
    return (
      uploadedPdfs.length > 0 ||
      selectedRefIds().size > 0 ||
      selectedLookupIds().size > 0 ||
      selectedDriveFiles().length > 0
    );
  };

  const totalStudyCount = createMemo(() => {
    const pdfCount = uploadedPdfs.filter(p => p.title?.trim() && !p.extracting).length;
    return (
      pdfCount + selectedRefIds().size + selectedLookupIds().size + selectedDriveFiles().length
    );
  });

  const pdfCount = () => uploadedPdfs.filter(p => p.title?.trim() && !p.extracting).length;
  const refCount = () => selectedRefIds().size;
  const lookupCount = () => selectedLookupIds().size;
  const driveCount = () => selectedDriveFiles().length;

  // In collect mode, notify parent of study changes
  createEffect(() => {
    if (!props.collectMode || !props.onStudiesChange) return;

    // Collect ready PDFs
    const pdfs = uploadedPdfs
      .filter(p => p.title?.trim() && !p.extracting && p.data)
      .map(p => ({
        title: p.title,
        fileName: p.file.name,
        data: p.data,
      }));

    // Collect selected imported references
    const selectedIds = selectedRefIds();
    const refs = importedRefs()
      .filter(r => selectedIds.has(r._id))
      .map(({ _id, ...ref }) => ({
        title: ref.title,
        metadata: {
          firstAuthor: ref.firstAuthor,
          publicationYear: ref.publicationYear,
          authors: ref.authors,
          journal: ref.journal,
          doi: ref.doi,
          abstract: ref.abstract,
          importSource: 'reference-file',
        },
      }));

    // Collect selected lookup references (only those with PDF available)
    const selectedLookups = selectedLookupIds();
    const lookups = lookupRefs()
      .filter(r => selectedLookups.has(r._id) && r.pdfAvailable)
      .map(({ _id, ...ref }) => ({
        title: ref.title,
        metadata: {
          firstAuthor: ref.firstAuthor,
          publicationYear: ref.publicationYear,
          authors: ref.authors,
          journal: ref.journal,
          doi: ref.doi,
          abstract: ref.abstract,
          pdfUrl: ref.pdfUrl,
          pdfSource: ref.pdfSource,
          importSource: ref.importSource || 'doi-lookup',
        },
      }));

    // Collect Google Drive files
    const driveFiles = selectedDriveFiles().map(file => ({
      id: file.id,
      name: file.name,
      size: file.size,
      importSource: 'google-drive',
    }));

    props.onStudiesChange({ pdfs, refs, lookups, driveFiles });
  });

  const handleExpand = () => {
    setInternalExpanded(true);
    props.onExpand?.();
  };

  const handleCollapse = () => {
    setInternalExpanded(false);
    props.onCollapse?.();
  };

  // Global drag-and-drop for collapsed state
  onMount(() => {
    if (props.alwaysExpanded) return;

    const handleDragEnter = e => {
      if (props.hasExistingStudies && !isExpanded() && e.dataTransfer?.types?.includes('Files')) {
        setIsDraggingOver(true);
      }
    };

    const handleDragLeave = e => {
      if (containerRef && !containerRef.contains(e.relatedTarget)) {
        setIsDraggingOver(false);
      }
    };

    const handleDragOver = e => {
      if (props.hasExistingStudies && !isExpanded() && isDraggingOver()) {
        e.preventDefault();
      }
    };

    const handleDrop = async e => {
      if (props.hasExistingStudies && !isExpanded() && isDraggingOver()) {
        e.preventDefault();
        setIsDraggingOver(false);
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length > 0) {
          handleExpand();
          await handlePdfSelect(files);
        }
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    onCleanup(() => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    });
  });

  // PDF handlers
  const handlePdfSelect = async files => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    handleExpand();
    setActiveTab('pdfs');

    const newPdfs = pdfFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      title: null,
      extracting: true,
      data: null,
    }));

    setUploadedPdfs(produce(pdfs => pdfs.push(...newPdfs)));

    for (const pdf of newPdfs) {
      try {
        const arrayBuffer = await readFileAsArrayBuffer(pdf.file);
        const title = await extractPdfTitle(arrayBuffer.slice(0));
        setUploadedPdfs(p => p.id === pdf.id, {
          title: title || pdf.file.name.replace(/\.pdf$/i, ''),
          extracting: false,
          data: arrayBuffer,
        });
      } catch (error) {
        console.error('Error extracting PDF title:', error);
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

  // Reference import handlers
  const handleRefFileSelect = async files => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setRefFileName(file.name);
    setParsingRefs(true);

    try {
      const refs = await parseReferenceFile(file);
      if (refs.length === 0) {
        showToast.warning('No References Found', 'The file does not contain any valid references.');
        setImportedRefs([]);
        setSelectedRefIds(new Set());
        return;
      }

      const refsWithIds = refs.map((ref, index) => ({ ...ref, _id: `ref-${index}` }));
      setImportedRefs(refsWithIds);
      setSelectedRefIds(new Set(refsWithIds.map(r => r._id)));
      showToast.success(
        'References Parsed',
        `Found ${refs.length} reference${refs.length === 1 ? '' : 's'}.`,
      );
    } catch (error) {
      console.error('Error parsing reference file:', error);
      showToast.error('Parse Error', 'Failed to parse the reference file.');
      setImportedRefs([]);
      setSelectedRefIds(new Set());
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
  };

  // DOI/PMID lookup handlers
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
        // Only auto-select refs that have PDFs available
        setSelectedLookupIds(prev => {
          const next = new Set(prev);
          newRefs.filter(r => r.pdfAvailable).forEach(r => next.add(r._id));
          return next;
        });
        setIdentifierInput('');

        const withPdf = newRefs.filter(r => r.pdfAvailable).length;
        const withoutPdf = newRefs.length - withPdf;

        if (withPdf > 0 && withoutPdf === 0) {
          showToast.success(
            'Lookup Complete',
            `Found ${withPdf} reference${withPdf === 1 ? '' : 's'} with PDF.`,
          );
        } else if (withPdf > 0 && withoutPdf > 0) {
          showToast.info(
            'Lookup Complete',
            `Found ${withPdf} with PDF, ${withoutPdf} without PDF access.`,
          );
        } else {
          showToast.warning(
            'No PDFs Available',
            `Found ${withoutPdf} reference${withoutPdf === 1 ? '' : 's'}, but none have open-access PDFs.`,
          );
        }
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
    // Only allow toggling refs that have PDFs available
    const ref = lookupRefs().find(r => r._id === id);
    if (!ref?.pdfAvailable) return;

    setSelectedLookupIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllLookup = () => {
    // Only toggle refs that have PDFs available
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

  // Google Drive handlers
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

  // Submit handler
  const handleSubmit = () => {
    const studies = [];

    // Add PDF studies
    for (const pdf of uploadedPdfs) {
      if (pdf.title?.trim() && !pdf.extracting) {
        studies.push({
          title: pdf.title.trim(),
          pdfData: pdf.data,
          pdfFileName: pdf.file?.name || null,
          importSource: 'pdf',
        });
      }
    }

    // Add imported reference studies
    const selectedRefs = importedRefs().filter(r => selectedRefIds().has(r._id));
    for (const ref of selectedRefs) {
      studies.push({
        title: ref.title,
        authors: ref.authors,
        journal: ref.journal,
        doi: ref.doi,
        abstract: ref.abstract,
        importSource: 'reference-file',
      });
    }

    // Add DOI/PMID lookup studies (only those with PDF available)
    const selectedLookups = lookupRefs().filter(
      r => selectedLookupIds().has(r._id) && r.pdfAvailable,
    );
    for (const ref of selectedLookups) {
      studies.push({
        title: ref.title,
        authors: ref.authors,
        journal: ref.journal,
        doi: ref.doi,
        abstract: ref.abstract,
        pdfUrl: ref.pdfUrl,
        pdfSource: ref.pdfSource,
        importSource: 'identifier-lookup',
      });
    }

    // Add Google Drive studies
    for (const file of selectedDriveFiles()) {
      studies.push({
        title: file.name.replace(/\.pdf$/i, ''),
        googleDriveFileId: file.id,
        googleDriveFileName: file.name,
        importSource: 'google-drive',
      });
    }

    if (studies.length === 0) {
      showToast.warning('No Studies', 'Please add at least one study to import.');
      return;
    }

    props.onAddStudies(studies);

    // Clear state
    setUploadedPdfs([]);
    clearImportedRefs();
    clearLookupRefs();
    clearDriveFiles();
    setInternalExpanded(false);
    props.onCollapse?.();
  };

  const handleCancel = () => {
    setUploadedPdfs([]);
    clearImportedRefs();
    clearLookupRefs();
    clearDriveFiles();
    setInternalExpanded(false);
    props.onCollapse?.();
  };

  const tabs = [
    { value: 'pdfs', label: 'Upload PDFs' },
    { value: 'references', label: 'Import References' },
    { value: 'lookup', label: 'DOI / PMID' },
    { value: 'drive', label: 'Google Drive' },
  ];

  return (
    <div ref={containerRef} class='relative'>
      {/* Drag overlay */}
      <Show when={isDraggingOver() && props.hasExistingStudies && !isExpanded()}>
        <div class='fixed inset-0 bg-blue-500/10 z-50 flex items-center justify-center pointer-events-none'>
          <div class='bg-white border-2 border-dashed border-blue-500 rounded-xl p-8 shadow-lg'>
            <p class='text-lg font-medium text-blue-600'>Drop PDFs to add studies</p>
          </div>
        </div>
      </Show>

      {/* Collapsed button */}
      <Show when={!isExpanded() && props.hasExistingStudies}>
        <button
          type='button'
          onClick={handleExpand}
          class='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm'
        >
          <BiRegularPlus class='w-4 h-4' />
          Add Studies
        </button>
      </Show>

      {/* Expanded form */}
      <Show when={isExpanded()}>
        <div
          class={`${props.collectMode ? '' : 'bg-white border border-gray-200 rounded-lg shadow-sm'} ${
            props.compact ? 'p-4'
            : props.collectMode ? ''
            : 'p-6'
          }`}
        >
          <Show when={!props.alwaysExpanded && !props.hideTitle}>
            <div class='flex items-center justify-between mb-4'>
              <h3 class='text-lg font-semibold text-gray-900'>Add Studies</h3>
              <button
                type='button'
                onClick={handleCollapse}
                class='p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors'
              >
                <FiChevronUp class='w-5 h-5' />
              </button>
            </div>
          </Show>

          <Tabs
            value={activeTab()}
            onValueChange={v => setActiveTab(v)}
            tabs={tabs.map(t => ({
              ...t,
              label: (
                <span class='flex items-center gap-2'>
                  {t.label}
                  <Show
                    when={
                      (t.value === 'pdfs' && pdfCount() > 0) ||
                      (t.value === 'references' && refCount() > 0) ||
                      (t.value === 'lookup' && lookupCount() > 0) ||
                      (t.value === 'drive' && driveCount() > 0)
                    }
                  >
                    <span class='inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full'>
                      {t.value === 'pdfs' ?
                        pdfCount()
                      : t.value === 'references' ?
                        refCount()
                      : t.value === 'lookup' ?
                        lookupCount()
                      : driveCount()}
                    </span>
                  </Show>
                </span>
              ),
            }))}
          />

          <div class='mt-4'>
            <Show when={activeTab() === 'pdfs'}>
              <PdfUploadSection
                uploadedPdfs={uploadedPdfs}
                onFilesChange={handlePdfSelect}
                onRemove={removePdf}
                onUpdateTitle={updatePdfTitle}
              />
            </Show>

            <Show when={activeTab() === 'references'}>
              <ReferenceImportSection
                importedRefs={importedRefs}
                selectedRefIds={selectedRefIds}
                refFileName={refFileName}
                parsingRefs={parsingRefs}
                onFileSelect={handleRefFileSelect}
                onToggleSelection={toggleRefSelection}
                onToggleSelectAll={toggleSelectAllRefs}
                onClear={clearImportedRefs}
              />
            </Show>

            <Show when={activeTab() === 'lookup'}>
              <DoiLookupSection
                identifierInput={identifierInput}
                setIdentifierInput={setIdentifierInput}
                lookupRefs={lookupRefs}
                selectedLookupIds={selectedLookupIds}
                lookingUp={lookingUp}
                lookupErrors={lookupErrors}
                onLookup={handleLookup}
                onToggleSelection={toggleLookupSelection}
                onToggleSelectAll={toggleSelectAllLookup}
                onRemove={removeLookupRef}
                onClear={clearLookupRefs}
              />
            </Show>

            <Show when={activeTab() === 'drive'}>
              <GoogleDriveSection
                selectedFiles={selectedDriveFiles}
                onToggleFile={toggleDriveFile}
                onRemoveFile={removeDriveFile}
                onClear={clearDriveFiles}
              />
            </Show>
          </div>

          {/* Summary and Actions - hidden in collect mode since parent handles submission */}
          <Show when={totalStudyCount() > 0 && !props.collectMode}>
            <div class='mt-4 pt-4 border-t border-gray-200'>
              <div class='flex items-center justify-between'>
                <div class='text-sm text-gray-600'>
                  <span class='font-medium'>{totalStudyCount()}</span>{' '}
                  {totalStudyCount() === 1 ? 'study' : 'studies'} ready to add
                  <span class='text-gray-400 ml-2'>
                    (
                    {[
                      pdfCount() > 0 ? `${pdfCount()} PDF${pdfCount() > 1 ? 's' : ''}` : null,
                      refCount() > 0 ? `${refCount()} imported` : null,
                      lookupCount() > 0 ? `${lookupCount()} from lookup` : null,
                      driveCount() > 0 ? `${driveCount()} from Drive` : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    )
                  </span>
                </div>
                <div class='flex items-center gap-2'>
                  <Show when={!props.alwaysExpanded}>
                    <button
                      type='button'
                      onClick={handleCancel}
                      class='px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors'
                    >
                      Cancel
                    </button>
                  </Show>
                  <button
                    type='button'
                    onClick={handleSubmit}
                    disabled={props.loading || totalStudyCount() === 0}
                    class='inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'
                  >
                    <Show
                      when={!props.loading}
                      fallback={
                        <>
                          <div class='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                          Adding...
                        </>
                      }
                    >
                      Add {totalStudyCount()} {totalStudyCount() === 1 ? 'Study' : 'Studies'}
                    </Show>
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Initial drop zone for empty projects */}
      <Show when={!isExpanded() && !props.hasExistingStudies}>
        <div
          class='border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-colors cursor-pointer'
          onClick={handleExpand}
        >
          <AiOutlineCloudUpload class='w-12 h-12 text-gray-400 mx-auto mb-3' />
          <p class='text-gray-600 font-medium'>Add Studies to Your Project</p>
          <p class='text-sm text-gray-500 mt-1'>
            Upload PDFs, import from reference managers, or look up by DOI/PMID
          </p>
        </div>
      </Show>
    </div>
  );
}
