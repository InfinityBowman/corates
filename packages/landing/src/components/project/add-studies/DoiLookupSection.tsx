/**
 * DoiLookupSection - DOI/PMID lookup section for AddStudiesForm
 * Handles identifier input, lookup, and result selection.
 * Only allows selecting references that have PDFs available (via Unpaywall).
 * Supports manual PDF upload for publisher-hosted articles that can't be auto-downloaded.
 */

import { useMemo, useRef, useCallback } from 'react';
import {
  SearchIcon,
  Trash2Icon,
  ExternalLinkIcon,
  UploadIcon,
  FileTextIcon,
  AlertCircleIcon,
  CheckIcon,
  DownloadIcon,
} from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { getRefDisplayName } from '@/lib/referenceParser.js';
import { validatePdfFile } from '@/lib/pdfValidation.js';

interface DoiLookupSectionProps {
  studies: any;
}

export function DoiLookupSection({ studies }: DoiLookupSectionProps) {
  const refsWithPdf = useMemo(
    () => studies.lookupRefs.filter((r: any) => r.pdfAvailable),
    [studies.lookupRefs],
  );
  const refsWithoutPdf = useMemo(
    () => studies.lookupRefs.filter((r: any) => !r.pdfAvailable),
    [studies.lookupRefs],
  );

  const allWithPdfSelected =
    refsWithPdf.length > 0 && refsWithPdf.every((r: any) => studies.selectedLookupIds.has(r._id));
  const someWithPdfSelected = studies.selectedLookupIds.size > 0 && !allWithPdfSelected;

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-muted-foreground text-sm'>
        Paste DOIs or PubMed IDs to find references with open-access PDFs. Only references with
        available PDFs can be added.
      </p>

      <div className='flex flex-col gap-2'>
        <textarea
          placeholder={'10.1000/xyz123\n32615397\n10.1016/j.example.2023.01.001'}
          value={studies.identifierInput}
          onChange={e => studies.setIdentifierInput(e.target.value)}
          rows={4}
          className='border-border text-foreground placeholder-muted-foreground/70 focus:ring-primary w-full rounded-lg border px-3 py-2 font-mono text-sm transition focus:border-transparent focus:ring-2 focus:outline-none'
        />
        <button
          type='button'
          onClick={() => studies.handleLookup()}
          disabled={studies.lookingUp || !studies.identifierInput.trim()}
          className='bg-primary hover:bg-primary/90 focus:ring-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
        >
          {studies.lookingUp ?
            <>
              <div className='size-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
              Looking up...
            </>
          : <>
              <SearchIcon className='size-4' />
              Look Up References
            </>
          }
        </button>
      </div>

      {/* Lookup errors */}
      {studies.lookupErrors.length > 0 && (
        <Alert variant='destructive'>
          <AlertCircleIcon />
          <div>
            <AlertTitle>Some lookups failed:</AlertTitle>
            <ul className='list-inside list-disc text-xs'>
              {studies.lookupErrors.map((err: any, i: number) => (
                <li key={i}>
                  <code className='font-mono'>{err.identifier}</code>: {err.error}
                </li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

      {/* Results */}
      {studies.lookupRefs.length > 0 && (
        <div className='flex flex-col gap-2'>
          <div className='flex items-center justify-between'>
            <span className='text-secondary-foreground text-sm'>
              Found references:{' '}
              <span className='font-medium text-green-600'>{refsWithPdf.length} with PDF</span>
              {refsWithoutPdf.length > 0 && (
                <>
                  <span className='text-muted-foreground/70 mx-1'>|</span>
                  <span className='text-amber-600'>{refsWithoutPdf.length} without PDF</span>
                </>
              )}
            </span>
            <button
              type='button'
              onClick={() => studies.clearLookupRefs()}
              className='text-xs text-red-600 hover:text-red-700 hover:underline'
            >
              Clear all
            </button>
          </div>

          {/* Select all with PDF */}
          {refsWithPdf.length > 0 && (
            <div className='border-border flex items-center gap-2 border-b pb-2'>
              <Checkbox
                id='select-all-lookup-pdfs'
                checked={someWithPdfSelected ? 'indeterminate' : allWithPdfSelected}
                onCheckedChange={() => studies.toggleSelectAllLookup()}
              />
              <label
                htmlFor='select-all-lookup-pdfs'
                className='cursor-pointer text-sm'
                onClick={() => studies.toggleSelectAllLookup()}
              >
                Select all with PDF ({studies.selectedLookupIds.size}/{refsWithPdf.length})
              </label>
            </div>
          )}

          <div className='flex max-h-64 flex-col gap-1 overflow-y-auto pr-1'>
            {/* References with PDF available */}
            {refsWithPdf.map((ref: any) => (
              <LookupRefWithPdf
                key={ref._id}
                ref_={ref}
                isSelected={studies.selectedLookupIds.has(ref._id)}
                onToggle={() => studies.toggleLookupSelection(ref._id)}
                onRemove={() => studies.removeLookupRef(ref._id)}
                onAttachPdf={studies.attachPdfToLookupRef}
              />
            ))}

            {/* References without PDF */}
            {refsWithoutPdf.length > 0 && (
              <div className='border-border mt-2 border-t pt-2'>
                <p className='mb-2 flex items-center gap-1 text-xs font-medium text-amber-600'>
                  <AlertCircleIcon className='size-3.5' />
                  No open-access PDF available:
                </p>
                {refsWithoutPdf.map((ref: any) => (
                  <LookupRefWithoutPdf
                    key={ref._id}
                    ref_={ref}
                    onRemove={() => studies.removeLookupRef(ref._id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Row for a lookup reference that has a PDF available (selectable).
 * Contains manual PDF upload via hidden file input for publisher-blocked PDFs.
 */
function LookupRefWithPdf({
  ref_,
  isSelected,
  onToggle,
  onRemove,
  onAttachPdf,
}: {
  ref_: any;
  isSelected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onAttachPdf: (_refId: string, _fileName: string, _arrayBuffer: ArrayBuffer) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleManualPdfSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const result = await validatePdfFile(file);
      if (!result.valid) {
        showToast.error('Invalid PDF', (result as any).details?.message || result.error);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        onAttachPdf(ref_._id, file.name, arrayBuffer);
        showToast.success('PDF Attached', `Attached ${file.name}`);
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils.js');
        await handleError(err, { toastTitle: 'Error' });
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [ref_._id, onAttachPdf],
  );

  return (
    <div
      className={`flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors ${
        isSelected ?
          'border border-green-200 bg-green-50 hover:bg-green-100'
        : 'bg-muted hover:bg-secondary border border-transparent'
      }`}
      onClick={onToggle}
    >
      {/* Hidden file input for manual PDF upload */}
      <input
        ref={fileInputRef}
        type='file'
        accept='application/pdf'
        className='hidden'
        onChange={handleManualPdfSelect}
      />

      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className='mt-0.5'
      />

      <div className='min-w-0 flex-1'>
        <div className='flex items-start gap-2'>
          <p className='text-foreground line-clamp-2 flex-1 text-sm font-medium'>{ref_.title}</p>
          <div className='flex shrink-0 items-center gap-1'>
            <PdfStatusBadge
              ref_={ref_}
              onUploadClick={e => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            />
            {/* External link to view accessible PDF */}
            {ref_.pdfUrl && ref_.pdfAccessible && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={ref_.pdfUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={e => e.stopPropagation()}
                    className='text-primary hover:bg-primary/10 inline-flex size-6 items-center justify-center rounded transition-colors'
                  >
                    <ExternalLinkIcon className='size-4' />
                  </a>
                </TooltipTrigger>
                <TooltipContent>View PDF</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <p className='text-muted-foreground mt-0.5 text-xs'>
          {getRefDisplayName(ref_)}
          {ref_.journal && (
            <>
              <span className='mx-1'>-</span>
              <span className='italic'>{ref_.journal}</span>
            </>
          )}
        </p>
        {ref_.doi && <p className='mt-0.5 font-mono text-xs text-blue-500'>{ref_.doi}</p>}
      </div>

      <button
        type='button'
        onClick={e => {
          e.stopPropagation();
          onRemove();
        }}
        className='text-muted-foreground/70 focus:ring-primary rounded p-1 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:outline-none'
      >
        <Trash2Icon className='size-4' />
      </button>
    </div>
  );
}

/**
 * PDF status badge for a lookup reference.
 * Three states: manual PDF attached, auto-accessible, or publisher-blocked (needs manual upload).
 */
function PdfStatusBadge({
  ref_,
  onUploadClick,
}: {
  ref_: any;
  onUploadClick: (_e: React.MouseEvent) => void;
}) {
  // Manual PDF already attached
  if (ref_.manualPdfData) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className='inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700'>
            <CheckIcon className='size-3' />
            PDF Ready
          </span>
        </TooltipTrigger>
        <TooltipContent>PDF uploaded: {ref_.manualPdfFileName}</TooltipContent>
      </Tooltip>
    );
  }

  // Auto-accessible via open access
  if (ref_.pdfAccessible) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className='inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700'>
            <FileTextIcon className='size-3' />
            PDF
          </span>
        </TooltipTrigger>
        <TooltipContent>
          PDF available via {ref_.pdfSource || 'repository'} - will auto-download
        </TooltipContent>
      </Tooltip>
    );
  }

  // Publisher-blocked: show upload button + optional download link
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type='button'
            onClick={onUploadClick}
            className='inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200'
          >
            <UploadIcon className='size-3' />
            Upload PDF
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Click to manually upload PDF after downloading from publisher
        </TooltipContent>
      </Tooltip>
      {ref_.pdfUrl && (
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={ref_.pdfUrl}
              target='_blank'
              rel='noopener noreferrer'
              onClick={e => e.stopPropagation()}
              className='text-primary hover:bg-primary/10 inline-flex size-6 items-center justify-center rounded transition-colors'
            >
              <DownloadIcon className='size-4' />
            </a>
          </TooltipTrigger>
          <TooltipContent>Download PDF from publisher (then upload)</TooltipContent>
        </Tooltip>
      )}
    </>
  );
}

/**
 * Row for a lookup reference without PDF (read-only, not selectable).
 */
function LookupRefWithoutPdf({ ref_, onRemove }: { ref_: any; onRemove: () => void }) {
  return (
    <div className='flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/50 p-2 opacity-75'>
      <div className='mt-0.5 flex size-5 items-center justify-center'>
        <FileTextIcon className='size-4 text-amber-400' />
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-secondary-foreground line-clamp-2 text-sm font-medium'>{ref_.title}</p>
        <p className='text-muted-foreground mt-0.5 text-xs'>
          {getRefDisplayName(ref_)}
          {ref_.journal && (
            <>
              <span className='mx-1'>-</span>
              <span className='italic'>{ref_.journal}</span>
            </>
          )}
        </p>
        {ref_.doi && (
          <div className='mt-1 flex items-center gap-2'>
            <span className='text-muted-foreground/70 font-mono text-xs'>{ref_.doi}</span>
            <a
              href={`https://doi.org/${ref_.doi}`}
              target='_blank'
              rel='noopener noreferrer'
              onClick={e => e.stopPropagation()}
              className='hover:text-primary inline-flex items-center gap-0.5 text-xs text-blue-500'
            >
              View <ExternalLinkIcon className='size-3' />
            </a>
          </div>
        )}
      </div>
      <button
        type='button'
        onClick={e => {
          e.stopPropagation();
          onRemove();
        }}
        className='text-muted-foreground/70 focus:ring-primary rounded p-1 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:outline-none'
      >
        <Trash2Icon className='size-4' />
      </button>
    </div>
  );
}
