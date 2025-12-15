/**
 * CreateLocalChecklist - Form to create a new local checklist
 * Allows setting a name, selecting checklist type, and optionally uploading a PDF
 */

import { createSignal, Show, For } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { FiFileText, FiX } from 'solid-icons/fi';
import useLocalChecklists from '@primitives/useLocalChecklists.js';
import { FileUpload } from '@components/zag/FileUpload.jsx';
import { LANDING_URL } from '@config/api.js';
import { getChecklistTypeOptions, DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';

export default function CreateLocalChecklist() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createChecklist, savePdf } = useLocalChecklists();

  const [name, setName] = createSignal('');
  const [checklistType, setChecklistType] = createSignal(DEFAULT_CHECKLIST_TYPE);
  const [pdfFile, setPdfFile] = createSignal(null);
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal(null);

  const typeOptions = getChecklistTypeOptions();

  const handleFilesChange = files => {
    const file = files[0];
    if (file) {
      setPdfFile(file);
      // Auto-fill name from PDF filename if name is empty
      if (!name()) {
        const baseName = file.name.replace(/\.pdf$/i, '');
        setName(baseName);
      }
    } else {
      setPdfFile(null);
    }
  };

  const clearPdf = () => {
    setPdfFile(null);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const checklistName = name().trim() || 'Untitled Checklist';
      const checklist = await createChecklist(checklistName, checklistType());

      // If a PDF was uploaded, save it
      if (pdfFile()) {
        const arrayBuffer = await pdfFile().arrayBuffer();
        await savePdf(checklist.id, arrayBuffer, pdfFile().name);
      }

      // Navigate to the new checklist
      navigate(`/checklist/${checklist.id}`);
    } catch (err) {
      console.error('Error creating checklist:', err);
      setError(err.message || 'Failed to create checklist');
      setCreating(false);
    }
  };

  const handleCancel = () => {
    const fromParam = searchParams.from;

    // If coming from landing page, navigate to landing
    if (fromParam === 'landing') {
      window.location.href = LANDING_URL;
    } else {
      // Otherwise go to dashboard
      navigate('/dashboard');
    }
  };

  return (
    <div class='min-h-full flex items-center justify-center p-6'>
      <div class='w-full max-w-lg'>
        <div class='bg-white rounded-xl shadow-sm border border-gray-200 p-8'>
          <h1 class='text-2xl font-bold text-gray-900 mb-2'>Start an Appraisal</h1>
          <p class='text-gray-600 mb-6'>
            Start a new quality assessment. Your progress will be saved locally on this device.
          </p>

          <form onSubmit={handleSubmit} class='space-y-6'>
            {/* Checklist Type */}
            <div>
              <label for='checklist-type' class='block text-sm font-medium text-gray-700 mb-2'>
                Assessment Type
              </label>
              <select
                id='checklist-type'
                value={checklistType()}
                onChange={e => setChecklistType(e.target.value)}
                class='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white'
              >
                <For each={typeOptions}>
                  {option => (
                    <option value={option.value}>
                      {option.label} - {option.description}
                    </option>
                  )}
                </For>
              </select>
            </div>

            {/* Checklist Name */}
            <div>
              <label for='checklist-name' class='block text-sm font-medium text-gray-700 mb-2'>
                Study Name
              </label>
              <input
                id='checklist-name'
                type='text'
                value={name()}
                onInput={e => setName(e.target.value)}
                placeholder='e.g., Study by Smith et al. 2024'
                class='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors'
              />
            </div>

            {/* PDF Upload */}
            <div>
              <label class='block text-sm font-medium text-gray-700 mb-2'>
                PDF Document <span class='text-gray-400'>(optional)</span>
              </label>

              <Show
                when={pdfFile()}
                fallback={
                  <FileUpload
                    accept='application/pdf'
                    helpText='PDF files only'
                    showFileList={false}
                    onFilesChange={handleFilesChange}
                  />
                }
              >
                <div class='flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
                  <FiFileText class='w-8 h-8 text-blue-600 shrink-0' />
                  <div class='flex-1 min-w-0'>
                    <p class='text-sm font-medium text-gray-900 truncate'>{pdfFile().name}</p>
                    <p class='text-xs text-gray-500'>
                      {(pdfFile().size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={clearPdf}
                    class='p-1 text-gray-400 hover:text-gray-600 transition-colors'
                  >
                    <FiX class='w-5 h-5' />
                  </button>
                </div>
              </Show>
            </div>

            {/* Error message */}
            <Show when={error()}>
              <div class='p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600'>
                {error()}
              </div>
            </Show>

            {/* Submit button */}
            <div class='flex gap-3'>
              <button
                type='button'
                onClick={handleCancel}
                class='flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={creating()}
                class='flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {creating() ? 'Adding...' : 'Start'}
              </button>
            </div>
          </form>

          {/* Info box */}
          <div class='mt-6 p-4 bg-gray-50 rounded-lg'>
            <p class='text-xs text-gray-500'>
              Local studies are stored only on this device and don't require an account. To
              collaborate with others or access your studies from multiple devices,{' '}
              <a href='/signup' class='text-blue-600 hover:underline'>
                create an account
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
