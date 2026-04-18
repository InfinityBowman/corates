/**
 * CreateLocalChecklist - Form to create a new local checklist
 * Allows setting a name, selecting checklist type, and optionally uploading a PDF
 */

import { useState, useCallback } from 'react';
import { useNavigate, useSearch, Link } from '@tanstack/react-router';
import { FileTextIcon, XIcon, CloudUploadIcon } from 'lucide-react';
import { connectionPool } from '@/project/ConnectionPool';
import { LOCAL_PROJECT_ID, createLocalAppraisal } from '@/project/localProject';
import { db } from '@/primitives/db';
import { Alert } from '@/components/ui/alert';
import { FileUpload, FileUploadDropzone, FileUploadHiddenInput } from '@/components/ui/file-upload';
import { LANDING_URL } from '@/config/api.js';
import { getChecklistTypeOptions, DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry/index';
import { validatePdfFile } from '@/lib/pdfValidation.js';

export function CreateLocalChecklist({ type: typeParam }: { type?: string }) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, string>;

  const [name, setName] = useState('');
  const [checklistType, setChecklistType] = useState(
    typeParam || (DEFAULT_CHECKLIST_TYPE as string),
  );
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeOptions = getChecklistTypeOptions() as any[];

  const handleFilesChange = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (file) {
        const result = await validatePdfFile(file);
        if (!result.valid) {
          setError((result as any).details?.message || (result as any).error);
          return;
        }
        setPdfFile(file);
        if (!name) {
          setName(file.name.replace(/\.pdf$/i, ''));
        }
      } else {
        setPdfFile(null);
      }
    },
    [name],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setCreating(true);

      try {
        const entry = connectionPool.getEntry(LOCAL_PROJECT_ID);
        if (!entry) {
          throw new Error('Local project not ready — reload the page and try again.');
        }
        const checklistName = name.trim() || 'Untitled Checklist';
        const id = createLocalAppraisal(entry.ydoc, {
          name: checklistName,
          type: checklistType,
        });
        if (!id) {
          throw new Error(`Unsupported checklist type: ${checklistType}`);
        }

        if (pdfFile) {
          const arrayBuffer = await pdfFile.arrayBuffer();
          await db.localChecklistPdfs.put({
            checklistId: id,
            data: arrayBuffer,
            fileName: pdfFile.name,
            updatedAt: Date.now(),
          });
        }

        navigate({ to: `/checklist/${id}` as string });
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils.js');
        await handleError(err, { setError, showToast: false });
        setCreating(false);
      }
    },
    [name, checklistType, pdfFile, navigate],
  );

  const handleCancel = useCallback(() => {
    if (search?.from === 'landing') {
      window.location.href = LANDING_URL;
    } else {
      navigate({ to: '/dashboard' });
    }
  }, [search, navigate]);

  return (
    <div className='flex min-h-full items-center justify-center p-6'>
      <div className='w-full max-w-lg'>
        <div className='border-border bg-card rounded-xl border p-8 shadow-sm'>
          <h1 className='text-foreground mb-2 text-2xl font-bold'>Start an Appraisal</h1>
          <p className='text-muted-foreground mb-6'>
            Start a new quality assessment. Your progress will be saved locally on this device.
          </p>

          <form onSubmit={handleSubmit} className='flex flex-col gap-6'>
            {/* Checklist Type */}
            <div>
              <label
                htmlFor='checklist-type'
                className='text-secondary-foreground mb-2 block text-sm font-medium'
              >
                Assessment Type
              </label>
              <select
                id='checklist-type'
                value={checklistType}
                onChange={e => setChecklistType(e.target.value)}
                className='border-border bg-card focus:border-primary focus:ring-primary w-full rounded-lg border px-4 py-3 transition-colors outline-none focus:ring-2'
              >
                {typeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Checklist Name */}
            <div>
              <label
                htmlFor='checklist-name'
                className='text-secondary-foreground mb-2 block text-sm font-medium'
              >
                Study Name
              </label>
              <input
                id='checklist-name'
                type='text'
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder='e.g., Study by Smith et al. 2024'
                className='border-border focus:border-primary focus:ring-primary w-full rounded-lg border px-4 py-3 transition-colors outline-none focus:ring-2'
              />
            </div>

            {/* PDF Upload */}
            <div>
              <label className='text-secondary-foreground mb-2 block text-sm font-medium'>
                PDF Document <span className='text-muted-foreground/70'>(optional)</span>
              </label>

              {pdfFile ?
                <div className='border-info-border bg-info-bg flex items-center gap-3 rounded-lg border p-4'>
                  <FileTextIcon className='text-info size-8 shrink-0' />
                  <div className='min-w-0 flex-1'>
                    <p className='text-foreground truncate text-sm font-medium'>{pdfFile.name}</p>
                    <p className='text-muted-foreground text-xs'>
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() => setPdfFile(null)}
                    className='text-muted-foreground/70 hover:text-muted-foreground p-1 transition-colors'
                  >
                    <XIcon className='size-5' />
                  </button>
                </div>
              : <FileUpload
                  accept={['application/pdf', '.pdf']}
                  maxFiles={1}
                  onFileAccept={(details: any) => handleFilesChange(details.files)}
                >
                  <FileUploadDropzone>
                    <CloudUploadIcon className='text-muted-foreground/70 size-8' />
                    <p className='text-muted-foreground mt-2 text-center text-sm'>
                      <span className='text-primary font-medium'>Click to upload</span> or drag and
                      drop
                    </p>
                    <p className='text-muted-foreground/70 mt-1 text-xs'>PDF files only</p>
                  </FileUploadDropzone>
                  <FileUploadHiddenInput />
                </FileUpload>
              }
            </div>

            {/* Error */}
            {error && <Alert variant='destructive'>{error}</Alert>}

            {/* Buttons */}
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={handleCancel}
                className='border-border text-secondary-foreground hover:bg-muted flex-1 rounded-lg border px-4 py-3 font-medium transition-colors'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={creating}
                className='flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {creating ? 'Adding...' : 'Start'}
              </button>
            </div>
          </form>

          <div className='bg-muted mt-6 rounded-lg p-4'>
            <p className='text-muted-foreground text-xs'>
              Local studies are stored only on this device and don't require an account. To
              collaborate with others or access your studies from multiple devices,{' '}
              <Link to='/signup' className='text-blue-600 hover:underline'>
                create an account
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
