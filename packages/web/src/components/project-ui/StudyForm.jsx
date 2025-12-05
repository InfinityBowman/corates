/**
 * StudyForm component - Form to create a new study
 * Unified experience: drop zone or button with editable study names
 * Shows visible drop zone when no studies exist, button when studies exist
 * Always supports drag-and-drop via hidden overlay
 */

import { createSignal, Show, For, createEffect, onMount, onCleanup } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { BiRegularTrash } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { FileUpload } from '@components/zag/FileUpload.jsx';
import { extractPdfTitle, readFileAsArrayBuffer } from '@/lib/pdfUtils.js';

export default function StudyForm(props) {
  const [uploadedPdfs, setUploadedPdfs] = createStore([]);
  const [isDraggingOver, setIsDraggingOver] = createSignal(false);
  let containerRef;

  // When studies are added and form collapses, clear the list
  createEffect(() => {
    if (!props.expanded && uploadedPdfs.length > 0) {
      // Only clear if not in the middle of processing
      const hasProcessing = uploadedPdfs.some(p => p.extracting);
      if (!hasProcessing && !props.loading) {
        setUploadedPdfs([]);
      }
    }
  });

  // Global drag-and-drop handler for when studies exist (hidden drop zone)
  onMount(() => {
    const handleDragEnter = e => {
      if (props.hasExistingStudies && !props.expanded) {
        // Check if dragging files
        if (e.dataTransfer?.types?.includes('Files')) {
          setIsDraggingOver(true);
        }
      }
    };

    const handleDragLeave = e => {
      // Only hide if leaving the container entirely
      if (containerRef && !containerRef.contains(e.relatedTarget)) {
        setIsDraggingOver(false);
      }
    };

    const handleDragOver = e => {
      if (props.hasExistingStudies && !props.expanded && isDraggingOver()) {
        e.preventDefault();
      }
    };

    const handleDrop = async e => {
      if (props.hasExistingStudies && !props.expanded && isDraggingOver()) {
        e.preventDefault();
        setIsDraggingOver(false);
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length > 0) {
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

  // Handle PDF file selection
  const handlePdfSelect = async files => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    // Auto-expand when files are dropped
    if (props.onExpand) {
      props.onExpand();
    }

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
        // Make a copy for PDF.js since it may detach the original buffer
        const bufferForExtraction = arrayBuffer.slice(0);
        const title = await extractPdfTitle(bufferForExtraction);

        setUploadedPdfs(p => p.id === pdf.id, {
          title: title || pdf.file.name.replace(/\.pdf$/i, ''),
          extracting: false,
          data: arrayBuffer,
        });
      } catch (error) {
        console.error('Error extracting PDF title:', error);
        // Still need to read the file for upload even if title extraction fails
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

  // Add a blank study entry (no PDF)
  const addBlankStudy = () => {
    if (props.onExpand) {
      props.onExpand();
    }
    setUploadedPdfs(
      produce(pdfs => {
        pdfs.push({
          id: crypto.randomUUID(),
          file: null,
          title: '',
          extracting: false,
          data: null,
        });
      }),
    );
  };

  const handleSubmit = () => {
    const studiesToProcess = uploadedPdfs.filter(p => p.title?.trim() && !p.extracting);
    for (const study of studiesToProcess) {
      props.onSubmit(study.title.trim(), '', study.data, study.file?.name || null);
    }
    setUploadedPdfs([]);
  };

  const canSubmit = () => {
    return uploadedPdfs.some(p => p.title?.trim() && !p.extracting);
  };

  const handleCancel = () => {
    setUploadedPdfs([]);
    props.onCancel?.();
  };

  const studyCount = () => uploadedPdfs.filter(p => p.title?.trim() && !p.extracting).length;
  const hasStudies = () => uploadedPdfs.length > 0;
  const isExpanded = () => props.expanded || hasStudies();
  const showDropZone = () => !props.hasExistingStudies || isExpanded();

  return (
    <div
      ref={containerRef}
      class={`rounded-lg transition-all relative ${
        isExpanded() ? 'bg-white border border-gray-200 shadow-sm p-6' : ''
      }`}
    >
      {/* Drag overlay when studies exist and dragging files */}
      <Show when={isDraggingOver() && props.hasExistingStudies && !isExpanded()}>
        <div class='fixed inset-0 bg-blue-500/10 z-50 flex items-center justify-center pointer-events-none'>
          <div class='bg-white border-2 border-dashed border-blue-500 rounded-xl p-8 shadow-lg'>
            <p class='text-lg font-medium text-blue-600'>Drop PDFs to add studies</p>
          </div>
        </div>
      </Show>

      <Show when={isExpanded()}>
        <h3 class='text-lg font-semibold text-gray-900 mb-4'>Add Studies</h3>
      </Show>

      <div class={isExpanded() ? 'space-y-4' : ''}>
        {/* Show drop zone when no existing studies, or when expanded */}
        <Show when={showDropZone()}>
          <FileUpload
            accept='application/pdf'
            multiple
            helpText={
              isExpanded() ?
                'Drag PDFs here or click to browse. Study names will be extracted automatically.'
              : 'Drop PDFs here to add studies, or click to browse'
            }
            showFileList={false}
            onFilesChange={handlePdfSelect}
            compact={!isExpanded()}
          />
        </Show>

        {/* Show button when studies exist and not expanded */}
        <Show when={props.hasExistingStudies && !isExpanded()}>
          <div class='flex justify-end'>
            <button
              onClick={() => props.onExpand?.()}
              class='inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg gap-2'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M12 4v16m8-8H4'
                />
              </svg>
              Add Study
            </button>
          </div>
        </Show>

        {/* Expanded content */}
        <Show when={isExpanded()}>
          {/* Studies list */}
          <Show when={uploadedPdfs.length > 0}>
            <div class='space-y-2'>
              <For each={uploadedPdfs}>
                {pdf => (
                  <div class='flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200'>
                    <Show
                      when={pdf.file}
                      fallback={<div class='w-5 h-5 rounded bg-gray-200 shrink-0' />}
                    >
                      <CgFileDocument class='w-5 h-5 text-red-500 shrink-0' />
                    </Show>
                    <div class='flex-1 min-w-0'>
                      <Show
                        when={!pdf.extracting}
                        fallback={
                          <div class='flex items-center gap-2'>
                            <div class='w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
                            <span class='text-sm text-gray-500'>Extracting title...</span>
                          </div>
                        }
                      >
                        <input
                          type='text'
                          value={pdf.title || ''}
                          onInput={e => updatePdfTitle(pdf.id, e.target.value)}
                          class='w-full text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                          placeholder='Enter study name'
                        />
                        <Show when={pdf.file}>
                          <p class='text-xs text-gray-500 truncate mt-1'>{pdf.file.name}</p>
                        </Show>
                      </Show>
                    </div>
                    <button
                      type='button'
                      onClick={() => removePdf(pdf.id)}
                      class='p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors'
                    >
                      <BiRegularTrash class='w-4 h-4' />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Add blank study button */}
          <button
            type='button'
            onClick={addBlankStudy}
            class='w-full py-2 px-4 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors'
          >
            + Add study without PDF
          </button>

          <div class='flex gap-3 mt-4'>
            <button
              onClick={handleSubmit}
              disabled={props.loading || !canSubmit()}
              class='inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md'
            >
              {props.loading ?
                'Adding...'
              : `Add ${studyCount()} Stud${studyCount() !== 1 ? 'ies' : 'y'}`}
            </button>
            <button
              onClick={handleCancel}
              class='px-4 py-2 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:border-blue-300 hover:text-blue-600 transition-colors'
            >
              Cancel
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
