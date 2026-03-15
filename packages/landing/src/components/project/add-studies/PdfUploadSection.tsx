/**
 * PdfUploadSection - PDF upload section for AddStudiesForm
 * Handles PDF file selection via Ark UI FileUpload. Staged items shown in StagedStudiesSection.
 */

import { useMemo } from 'react';
import { CloudUploadIcon, FileIcon, AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';
import { FileUpload, FileUploadDropzone, FileUploadHiddenInput } from '@/components/ui/file-upload';

interface PdfUploadSectionProps {
  studies: any;
}

export function PdfUploadSection({ studies }: PdfUploadSectionProps) {
  const pendingPdfs = useMemo(
    () => studies.uploadedPdfs.filter((pdf: any) => pdf.extracting || pdf.error),
    [studies.uploadedPdfs],
  );

  return (
    <div className='space-y-3'>
      <p className='text-muted-foreground text-sm'>
        Upload research papers to automatically create studies. Titles will be extracted from each
        PDF.
      </p>

      <FileUpload
        accept={['application/pdf', '.pdf']}
        maxFiles={Infinity}
        onFileAccept={(details: any) => studies.handlePdfSelect(details.files)}
      >
        <FileUploadDropzone className='min-h-24 p-4'>
          <CloudUploadIcon className='text-muted-foreground/70 h-6 w-6' />
          <p className='text-secondary-foreground mt-2 text-center text-xs'>
            <span className='text-primary font-medium'>Click to upload</span> or drag and drop
          </p>
          <p className='text-muted-foreground/70 mt-1 text-xs'>PDF files only</p>
        </FileUploadDropzone>
        <FileUploadHiddenInput />
      </FileUpload>

      {pendingPdfs.length > 0 && (
        <div className='space-y-2'>
          {pendingPdfs.map((pdf: any) => (
            <div
              key={pdf.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                pdf.error ? 'border-red-200 bg-red-50' : 'bg-muted border-border'
              }`}
            >
              <FileIcon
                className={`h-5 w-5 shrink-0 ${pdf.error ? 'text-red-600' : 'text-muted-foreground'}`}
              />
              <div className='min-w-0 flex-1'>
                {pdf.error ?
                  <>
                    <div className='flex items-center gap-2'>
                      <AlertTriangleIcon className='h-4 w-4 shrink-0 text-red-600' />
                      <span className='text-sm font-medium text-red-600'>{pdf.error}</span>
                      <button
                        type='button'
                        onClick={() => studies.retryPdfExtraction?.(pdf.id)}
                        className='inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200'
                      >
                        <RefreshCwIcon className='h-3 w-3' />
                        Retry
                      </button>
                    </div>
                    <p className='mt-1 truncate text-xs text-red-600'>{pdf.file.name}</p>
                  </>
                : <>
                    <div className='flex items-center gap-2'>
                      <div className='h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
                      <span className='text-muted-foreground text-sm'>Extracting metadata...</span>
                    </div>
                    <p className='text-muted-foreground/70 mt-1 truncate text-xs'>
                      {pdf.file.name}
                    </p>
                  </>
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
