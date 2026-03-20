/**
 * PdfUploadSection - PDF upload section for AddStudiesForm
 * Handles PDF file selection via Ark UI FileUpload. Staged items shown in StagedStudiesSection.
 */

import { useMemo } from 'react';
import { CloudUploadIcon, FileTextIcon, AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';
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
    <div className='flex flex-col gap-3'>
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
          <CloudUploadIcon className='text-muted-foreground/70 size-6' />
          <p className='text-secondary-foreground mt-2 text-center text-xs'>
            <span className='text-primary font-medium'>Click to upload</span> or drag and drop
          </p>
          <p className='text-muted-foreground/70 mt-1 text-xs'>PDF files only</p>
        </FileUploadDropzone>
        <FileUploadHiddenInput />
      </FileUpload>

      {pendingPdfs.length > 0 && (
        <div className='flex flex-col gap-2'>
          {pendingPdfs.map((pdf: any) => (
            <div
              key={pdf.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                pdf.error ? 'border-destructive/20 bg-destructive/10' : 'bg-muted border-border'
              }`}
            >
              <FileTextIcon
                className={`size-5 shrink-0 ${pdf.error ? 'text-destructive' : 'text-muted-foreground'}`}
              />
              <div className='min-w-0 flex-1'>
                {pdf.error ?
                  <>
                    <div className='flex items-center gap-2'>
                      <AlertTriangleIcon className='text-destructive size-4 shrink-0' />
                      <span className='text-destructive text-sm font-medium'>{pdf.error}</span>
                      <button
                        type='button'
                        onClick={() => studies.retryPdfExtraction?.(pdf.id)}
                        className='inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200'
                      >
                        <RefreshCwIcon className='size-3' />
                        Retry
                      </button>
                    </div>
                    <p className='text-destructive mt-1 truncate text-xs'>{pdf.file.name}</p>
                  </>
                : <>
                    <div className='flex items-center gap-2'>
                      <div className='size-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
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
