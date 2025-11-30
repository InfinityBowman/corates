/**
 * CreateLocalChecklist - Form to create a new local checklist
 * Allows setting a name and optionally uploading a PDF
 */

import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { FiUpload, FiX, FiFileText } from 'solid-icons/fi';
import useLocalChecklists from '@primitives/useLocalChecklists.js';

export default function CreateLocalChecklist() {
  const navigate = useNavigate();
  const { createChecklist, savePdf } = useLocalChecklists();

  const [name, setName] = createSignal('');
  const [pdfFile, setPdfFile] = createSignal(null);
  const [pdfFileName, setPdfFileName] = createSignal('');
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal(null);
  const [dragOver, setDragOver] = createSignal(false);

  let fileInputRef;

  const handleFileSelect = async e => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setPdfFileName(file.name);
      // Auto-fill name from PDF filename if name is empty
      if (!name()) {
        const baseName = file.name.replace(/\.pdf$/i, '');
        setName(baseName);
      }
    }
  };

  const handleDrop = async e => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setPdfFileName(file.name);
      if (!name()) {
        const baseName = file.name.replace(/\.pdf$/i, '');
        setName(baseName);
      }
    }
  };

  const handleDragOver = e => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = e => {
    e.preventDefault();
    setDragOver(false);
  };

  const clearPdf = () => {
    setPdfFile(null);
    setPdfFileName('');
    if (fileInputRef) {
      fileInputRef.value = '';
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const checklistName = name().trim() || 'Untitled Checklist';
      const checklist = await createChecklist(checklistName, 'AMSTAR2');

      // If a PDF was uploaded, save it
      if (pdfFile()) {
        const arrayBuffer = await pdfFile().arrayBuffer();
        await savePdf(checklist.id, arrayBuffer, pdfFileName());
      }

      // Navigate to the new checklist
      navigate(`/checklist/${checklist.id}`);
    } catch (err) {
      console.error('Error creating checklist:', err);
      setError(err.message || 'Failed to create checklist');
      setCreating(false);
    }
  };

  return (
    <div class='min-h-screen bg-gray-50 flex items-center justify-center p-6'>
      <div class='w-full max-w-lg'>
        <div class='bg-white rounded-xl shadow-sm border border-gray-200 p-8'>
          <h1 class='text-2xl font-bold text-gray-900 mb-2'>Start an Appraisal</h1>
          <p class='text-gray-600 mb-6'>
            Start a new AMSTAR-2 assessment. Your checklist will be saved locally on this device.
          </p>

          <form onSubmit={handleSubmit} class='space-y-6'>
            {/* Checklist Name */}
            <div>
              <label for='checklist-name' class='block text-sm font-medium text-gray-700 mb-2'>
                Checklist Name
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

              {pdfFile() ?
                <div class='flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
                  <FiFileText class='w-8 h-8 text-blue-600 shrink-0' />
                  <div class='flex-1 min-w-0'>
                    <p class='text-sm font-medium text-gray-900 truncate'>{pdfFileName()}</p>
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
              : <div
                  class={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragOver() ?
                      'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='application/pdf'
                    onChange={handleFileSelect}
                    class='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
                  />
                  <FiUpload class='w-10 h-10 text-gray-400 mx-auto mb-3' />
                  <p class='text-sm text-gray-600'>
                    <span class='font-medium text-blue-600'>Click to upload</span> or drag and drop
                  </p>
                  <p class='text-xs text-gray-500 mt-1'>PDF files only</p>
                </div>
              }
            </div>

            {/* Error message */}
            {error() && (
              <div class='p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600'>
                {error()}
              </div>
            )}

            {/* Submit button */}
            <div class='flex gap-3'>
              <button
                type='button'
                onClick={() => navigate('/dashboard')}
                class='flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={creating()}
                class='flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {creating() ? 'Creating...' : 'Create Checklist'}
              </button>
            </div>
          </form>

          {/* Info box */}
          <div class='mt-6 p-4 bg-gray-50 rounded-lg'>
            <p class='text-xs text-gray-500'>
              Local checklists are stored only on this device and don't require an account. To
              collaborate with others or access your checklists from multiple devices,{' '}
              <a href='/signup' class='text-blue-600 hover:underline'>
                create a free account
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
