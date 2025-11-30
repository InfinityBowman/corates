/**
 * StudyForm component - Form to create a new study
 * Supports manual entry or PDF upload with automatic title extraction
 */

import { createSignal, Show, For } from 'solid-js';
import { BiRegularCloudUpload, BiRegularTrash } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { extractPdfTitle, readFileAsArrayBuffer } from '@/lib/pdfUtils.js';

export default function StudyForm(props) {
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [uploadMode, setUploadMode] = createSignal(false);
  const [uploadedPdfs, setUploadedPdfs] = createSignal([]);
  const [isDragging, setIsDragging] = createSignal(false);

  let fileInputRef;

  // Handle PDF file selection
  const handlePdfSelect = async files => {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    const newPdfs = pdfFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      title: null,
      extracting: true,
      data: null,
    }));

    setUploadedPdfs(prev => [...prev, ...newPdfs]);

    for (const pdf of newPdfs) {
      try {
        const arrayBuffer = await readFileAsArrayBuffer(pdf.file);
        // Make a copy for PDF.js since it may detach the original buffer
        const bufferForExtraction = arrayBuffer.slice(0);
        const title = await extractPdfTitle(bufferForExtraction);

        setUploadedPdfs(prev =>
          prev.map(p =>
            p.id === pdf.id ?
              {
                ...p,
                title: title || pdf.file.name.replace(/\.pdf$/i, ''),
                extracting: false,
                data: arrayBuffer,
              }
            : p,
          ),
        );
      } catch (error) {
        console.error('Error extracting PDF title:', error);
        // Still need to read the file for upload even if title extraction fails
        let fileData = null;
        try {
          fileData = await readFileAsArrayBuffer(pdf.file);
        } catch (e) {
          console.error('Error reading PDF file:', e);
        }
        setUploadedPdfs(prev =>
          prev.map(p =>
            p.id === pdf.id ?
              {
                ...p,
                title: pdf.file.name.replace(/\.pdf$/i, ''),
                extracting: false,
                data: fileData,
              }
            : p,
          ),
        );
      }
    }
  };

  const removePdf = id => {
    setUploadedPdfs(prev => prev.filter(p => p.id !== id));
  };

  const updatePdfTitle = (id, newTitle) => {
    setUploadedPdfs(prev => prev.map(p => (p.id === id ? { ...p, title: newTitle } : p)));
  };

  const handleDragOver = e => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = e => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = e => {
    e.preventDefault();
    setIsDragging(false);
    handlePdfSelect(e.dataTransfer.files);
  };

  const handleSubmit = () => {
    if (uploadMode()) {
      // Submit each PDF as a separate study
      const pdfsToProcess = uploadedPdfs().filter(p => p.title && !p.extracting);
      for (const pdf of pdfsToProcess) {
        props.onSubmit(pdf.title, '', pdf.data, pdf.file.name);
      }
      setUploadedPdfs([]);
    } else {
      if (!name().trim()) return;
      props.onSubmit(name().trim(), description().trim());
      setName('');
      setDescription('');
    }
  };

  const canSubmit = () => {
    if (uploadMode()) {
      return uploadedPdfs().some(p => p.title && !p.extracting);
    }
    return name().trim().length > 0;
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setUploadedPdfs([]);
    setUploadMode(false);
    props.onCancel();
  };

  return (
    <div class='bg-white border border-gray-200 rounded-lg shadow-sm p-6'>
      <div class='flex items-center justify-between mb-4'>
        <h3 class='text-lg font-semibold text-gray-900'>Create New Study</h3>
        <div class='flex gap-1 bg-gray-100 p-1 rounded-lg'>
          <button
            onClick={() => setUploadMode(false)}
            class={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              !uploadMode() ?
                'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => setUploadMode(true)}
            class={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              uploadMode() ?
                'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upload PDF
          </button>
        </div>
      </div>

      <Show when={!uploadMode()}>
        <div class='space-y-4'>
          <div>
            <label class='block text-sm font-semibold text-gray-700 mb-2'>Study Name</label>
            <input
              type='text'
              placeholder='e.g., Sleep Interventions Systematic Review'
              value={name()}
              onInput={e => setName(e.target.value)}
              class='w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
            />
          </div>
          <div>
            <label class='block text-sm font-semibold text-gray-700 mb-2'>
              Description (Optional)
            </label>
            <textarea
              placeholder='Brief description of this study...'
              value={description()}
              onInput={e => setDescription(e.target.value)}
              rows='2'
              class='w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
            />
          </div>
        </div>
      </Show>

      <Show when={uploadMode()}>
        <div class='space-y-4'>
          <p class='text-sm text-gray-500'>
            Upload PDFs to automatically create studies. Titles will be extracted from each PDF.
          </p>

          {/* Drop zone */}
          <div
            class={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging() ?
                'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef?.click()}
          >
            <BiRegularCloudUpload class='w-10 h-10 mx-auto text-gray-400 mb-2' />
            <p class='text-sm text-gray-600'>
              <span class='font-medium text-blue-600'>Click to upload</span> or drag and drop
            </p>
            <p class='text-xs text-gray-500 mt-1'>PDF files only</p>
            <input
              ref={fileInputRef}
              type='file'
              accept='application/pdf'
              multiple
              class='hidden'
              onChange={e => handlePdfSelect(e.target.files)}
            />
          </div>

          {/* Uploaded PDFs list */}
          <Show when={uploadedPdfs().length > 0}>
            <div class='space-y-2'>
              <For each={uploadedPdfs()}>
                {pdf => (
                  <div class='flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200'>
                    <CgFileDocument class='w-5 h-5 text-red-500 shrink-0' />
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
                          class='w-full text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0'
                          placeholder='Study title'
                        />
                        <p class='text-xs text-gray-500 truncate'>{pdf.file.name}</p>
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
              <p class='text-xs text-gray-500'>
                {uploadedPdfs().length} PDF{uploadedPdfs().length !== 1 ? 's' : ''} will add{' '}
                {uploadedPdfs().length} stud{uploadedPdfs().length !== 1 ? 'ies' : 'y'}
              </p>
            </div>
          </Show>
        </div>
      </Show>

      <div class='flex gap-3 mt-4'>
        <button
          onClick={handleSubmit}
          disabled={props.loading || !canSubmit()}
          class='inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md'
        >
          {props.loading ?
            'Creating...'
          : uploadMode() ?
            `Create ${uploadedPdfs().filter(p => !p.extracting).length} Stud${uploadedPdfs().filter(p => !p.extracting).length !== 1 ? 'ies' : 'y'}`
          : 'Create Study'}
        </button>
        <button
          onClick={handleCancel}
          class='px-4 py-2 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:border-blue-300 hover:text-blue-600 transition-colors'
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
