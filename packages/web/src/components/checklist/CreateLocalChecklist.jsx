/**
 * CreateLocalChecklist - Form to create a new local checklist
 * Allows setting a name, selecting checklist type, and optionally uploading a PDF
 */

import { createSignal, Show, For } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { FiFileText, FiX, FiUploadCloud } from 'solid-icons/fi';
import localChecklistsStore from '@/stores/localChecklistsStore';
import { FileUpload, FileUploadDropzone, FileUploadHiddenInput } from '@/components/ui/file-upload';
import { LANDING_URL } from '@config/api.js';
import { getChecklistTypeOptions, DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';
import { validatePdfFile } from '@/lib/pdfValidation.js';

export default function CreateLocalChecklist() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createChecklist, savePdf } = localChecklistsStore;

  const [name, setName] = createSignal('');
  const [checklistType, setChecklistType] = createSignal(
    searchParams.type || DEFAULT_CHECKLIST_TYPE,
  );
  const [pdfFile, setPdfFile] = createSignal(null);
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal(null);

  const typeOptions = getChecklistTypeOptions();

  const handleFilesChange = async files => {
    const file = files[0];
    if (file) {
      const result = await validatePdfFile(file);
      if (!result.valid) {
        setError(result.error);
        return;
      }
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
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        setError,
        showToast: false,
      });
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
    <div class='flex min-h-full items-center justify-center p-6'>
      <div class='w-full max-w-lg'>
        <div class='border-border bg-card rounded-xl border p-8 shadow-sm'>
          <h1 class='text-foreground mb-2 text-2xl font-bold'>Start an Appraisal</h1>
          <p class='text-muted-foreground mb-6'>
            Start a new quality assessment. Your progress will be saved locally on this device.
          </p>

          <form onSubmit={handleSubmit} class='space-y-6'>
            {/* Checklist Type */}
            <div>
              <label
                for='checklist-type'
                class='text-secondary-foreground mb-2 block text-sm font-medium'
              >
                Assessment Type
              </label>
              <select
                id='checklist-type'
                value={checklistType()}
                onChange={e => setChecklistType(e.target.value)}
                class='border-border bg-card focus:border-primary focus:ring-primary w-full rounded-lg border px-4 py-3 transition-colors outline-none focus:ring-2'
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
              <label
                for='checklist-name'
                class='text-secondary-foreground mb-2 block text-sm font-medium'
              >
                Study Name
              </label>
              <input
                id='checklist-name'
                type='text'
                value={name()}
                onInput={e => setName(e.target.value)}
                placeholder='e.g., Study by Smith et al. 2024'
                class='border-border focus:border-primary focus:ring-primary w-full rounded-lg border px-4 py-3 transition-colors outline-none focus:ring-2'
              />
            </div>

            {/* PDF Upload */}
            <div>
              <label class='text-secondary-foreground mb-2 block text-sm font-medium'>
                PDF Document <span class='text-muted-foreground/70'>(optional)</span>
              </label>

              <Show
                when={pdfFile()}
                fallback={
                  <FileUpload
                    accept={['application/pdf', '.pdf']}
                    maxFiles={1}
                    onFileAccept={details => handleFilesChange(details.files)}
                  >
                    <FileUploadDropzone>
                      <FiUploadCloud class='text-muted-foreground/70 h-8 w-8' />
                      <p class='text-muted-foreground mt-2 text-center text-sm'>
                        <span class='font-medium text-blue-600'>Click to upload</span> or drag and
                        drop
                      </p>
                      <p class='text-muted-foreground/70 mt-1 text-xs'>PDF files only</p>
                    </FileUploadDropzone>
                    <FileUploadHiddenInput />
                  </FileUpload>
                }
              >
                <div class='flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4'>
                  <FiFileText class='h-8 w-8 shrink-0 text-blue-600' />
                  <div class='min-w-0 flex-1'>
                    <p class='text-foreground truncate text-sm font-medium'>{pdfFile().name}</p>
                    <p class='text-muted-foreground text-xs'>
                      {(pdfFile().size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={clearPdf}
                    class='text-muted-foreground/70 hover:text-muted-foreground p-1 transition-colors'
                  >
                    <FiX class='h-5 w-5' />
                  </button>
                </div>
              </Show>
            </div>

            {/* Error message */}
            <Show when={error()}>
              <div class='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600'>
                {error()}
              </div>
            </Show>

            {/* Submit button */}
            <div class='flex gap-3'>
              <button
                type='button'
                onClick={handleCancel}
                class='border-border text-secondary-foreground hover:bg-muted flex-1 rounded-lg border px-4 py-3 font-medium transition-colors'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={creating()}
                class='flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {creating() ? 'Adding...' : 'Start'}
              </button>
            </div>
          </form>

          {/* Info box */}
          <div class='bg-muted mt-6 rounded-lg p-4'>
            <p class='text-muted-foreground text-xs'>
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
