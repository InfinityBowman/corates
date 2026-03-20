/**
 * ReferenceImportSection - Reference file import section for AddStudiesForm
 * Handles RIS, BibTeX, EndNote file parsing and reference selection.
 * Supports dropping PDFs alongside reference files for automatic matching.
 */

import { CloudUploadIcon, FileTextIcon, Link2Icon } from 'lucide-react';
import { FileUpload, FileUploadDropzone, FileUploadHiddenInput } from '@/components/ui/file-upload';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getRefDisplayName,
  SUPPORTED_FORMATS,
  MIXED_IMPORT_ACCEPT,
} from '@/lib/referenceParser.js';

interface ReferenceImportSectionProps {
  studies: any;
}

export function ReferenceImportSection({ studies }: ReferenceImportSectionProps) {
  const hasRefs = studies.importedRefs.length > 0;

  if (hasRefs) {
    const allSelected = studies.selectedRefIds.size === studies.importedRefs.length;
    const someSelected = studies.selectedRefIds.size > 0 && !allSelected;

    return (
      <div className='flex flex-col gap-3'>
        {/* File name chip */}
        <div className='bg-muted flex items-center justify-between rounded-lg px-3 py-2'>
          <div className='text-secondary-foreground flex items-center gap-2 text-sm'>
            <FileTextIcon className='size-4' />
            <span className='max-w-48 truncate'>{studies.refFileName}</span>
            <span className='text-muted-foreground/70'>
              ({studies.importedRefs.length} references)
            </span>
          </div>
          <button
            type='button'
            onClick={studies.clearImportedRefs}
            className='text-primary hover:text-primary/80 text-xs font-medium'
          >
            Change file
          </button>
        </div>

        {/* PDF matching status badges */}
        {(studies.matchedRefPdfCount > 0 ||
          studies.unmatchedRefPdfCount > 0 ||
          studies.lookingUpRefPdfs ||
          studies.foundPdfCount > 0) && (
          <div className='flex flex-wrap items-center gap-3 text-xs'>
            {studies.lookingUpRefPdfs && (
              <span className='inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-700'>
                <div className='size-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
                Looking up PDFs...
              </span>
            )}
            {studies.matchedRefPdfCount > 0 && (
              <span className='inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-green-700'>
                <Link2Icon className='size-3' />
                {studies.matchedRefPdfCount} PDF
                {studies.matchedRefPdfCount > 1 ? 's' : ''} matched
              </span>
            )}
            {studies.foundPdfCount > 0 && (
              <span className='inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700'>
                <FileTextIcon className='size-3' />
                {studies.foundPdfCount} open access
              </span>
            )}
            {studies.unmatchedRefPdfCount > 0 && (
              <span className='inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700'>
                <FileTextIcon className='size-3' />
                {studies.unmatchedRefPdfCount} PDF
                {studies.unmatchedRefPdfCount > 1 ? 's' : ''} unmatched
              </span>
            )}
          </div>
        )}

        {/* Select all */}
        <div className='border-border flex items-center gap-2 border-b pb-2'>
          <Checkbox
            checked={someSelected ? 'indeterminate' : allSelected}
            onCheckedChange={() => studies.toggleSelectAllRefs()}
          />
          <label className='cursor-pointer text-sm' onClick={() => studies.toggleSelectAllRefs()}>
            Select all ({studies.selectedRefIds.size}/{studies.importedRefs.length})
          </label>
        </div>

        {/* Reference list */}
        <div className='flex max-h-48 flex-col gap-1 overflow-y-auto pr-1'>
          {studies.importedRefs.map((ref: any) => (
            <div
              key={ref._id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors ${
                studies.selectedRefIds.has(ref._id) ?
                  'bg-blue-50 hover:bg-blue-100'
                : 'bg-muted hover:bg-secondary'
              }`}
              onClick={() => studies.toggleRefSelection(ref._id)}
            >
              <Checkbox
                checked={studies.selectedRefIds.has(ref._id)}
                onCheckedChange={() => studies.toggleRefSelection(ref._id)}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                className='mt-0.5'
              />
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <p className='text-foreground line-clamp-2 flex-1 text-sm font-medium'>
                    {ref.title}
                  </p>
                  {ref.pdfData && (
                    <span className='inline-flex shrink-0 items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700'>
                      <FileTextIcon className='size-3' />
                      PDF
                    </span>
                  )}
                  {!ref.pdfData && ref.pdfAvailable && (
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                        ref.pdfAccessible ?
                          'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}
                      title={
                        ref.pdfAccessible ?
                          'Open access PDF available'
                        : 'PDF available (may require manual download)'
                      }
                    >
                      <Link2Icon className='size-3' />
                      {ref.pdfAccessible ? 'OA' : 'PDF'}
                    </span>
                  )}
                </div>
                <p className='text-muted-foreground mt-0.5 text-xs'>
                  {getRefDisplayName(ref)}
                  {ref.journal && (
                    <>
                      <span className='mx-1'>-</span>
                      <span className='italic'>{ref.journal}</span>
                    </>
                  )}
                  {ref.pdfFileName && (
                    <>
                      <span className='mx-1'>-</span>
                      <span className='inline-block max-w-32 truncate align-bottom text-green-600'>
                        {ref.pdfFileName}
                      </span>
                    </>
                  )}
                  {!ref.pdfData && ref.pdfSource && (
                    <>
                      <span className='mx-1'>-</span>
                      <span className='text-emerald-600'>{ref.pdfSource}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state - show file upload
  return (
    <div className='flex flex-col gap-3'>
      <p className='text-muted-foreground text-sm'>
        Import references from Zotero, EndNote, Mendeley, or other reference managers. You can also
        drop PDFs alongside your reference file to automatically match them.
      </p>

      <FileUpload
        accept={(MIXED_IMPORT_ACCEPT as string).split(',').map((t: string) => t.trim())}
        maxFiles={Infinity}
        onFileAccept={(details: any) => studies.handleRefFileSelect(details.files)}
      >
        <FileUploadDropzone className='min-h-24 p-4'>
          <CloudUploadIcon className='text-muted-foreground/70 size-6' />
          <p className='text-secondary-foreground mt-2 text-center text-xs'>
            <span className='text-primary font-medium'>Click to upload</span> or drag and drop
          </p>
          <p className='text-muted-foreground/70 mt-1 text-xs'>
            RIS, EndNote, BibTeX, or PDF files
          </p>
        </FileUploadDropzone>
        <FileUploadHiddenInput />
      </FileUpload>

      <div className='text-muted-foreground text-xs'>
        <p className='mb-1 font-medium'>Supported formats:</p>
        <ul className='flex list-inside list-disc flex-col gap-0.5'>
          {(SUPPORTED_FORMATS as any[]).map((format: any) => (
            <li key={format.extension}>
              <span className='font-medium'>{format.extension}</span> - {format.description}
            </li>
          ))}
        </ul>
        <p className='text-muted-foreground/70 mt-2'>
          Tip: Drop a folder from your reference manager to import references and PDFs together.
        </p>
      </div>

      {studies.parsingRefs && (
        <div className='text-muted-foreground flex items-center justify-center gap-2 py-4'>
          <div className='size-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
          <span>Parsing references...</span>
        </div>
      )}
    </div>
  );
}
