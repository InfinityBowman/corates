/**
 * ReferenceImportSection - Reference file import section for AddStudiesForm
 * Handles RIS, BibTeX, EndNote file parsing and reference selection
 * Supports dropping PDFs alongside reference files for automatic matching
 */

import { For, Show } from 'solid-js';
import { AiOutlineFileText } from 'solid-icons/ai';
import { CgFileDocument } from 'solid-icons/cg';
import { BiRegularLinkAlt } from 'solid-icons/bi';
import { FileUpload, Checkbox } from '@corates/ui';
import {
  getRefDisplayName,
  SUPPORTED_FORMATS,
  MIXED_IMPORT_ACCEPT,
} from '@/lib/referenceParser.js';

export default function ReferenceImportSection(props) {
  const studies = () => props.studies;

  return (
    <div class='space-y-3'>
      <Show
        when={studies().importedRefs().length === 0}
        fallback={
          <div class='space-y-3'>
            <div class='flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2'>
              <div class='flex items-center gap-2 text-sm text-gray-600'>
                <AiOutlineFileText class='h-4 w-4' />
                <span class='max-w-48 truncate'>{studies().refFileName()}</span>
                <span class='text-gray-400'>({studies().importedRefs().length} references)</span>
              </div>
              <button
                type='button'
                onClick={studies().clearImportedRefs}
                class='text-xs font-medium text-blue-600 hover:text-blue-700'
              >
                Change file
              </button>
            </div>

            {/* PDF matching status */}
            <Show
              when={
                studies().matchedRefPdfCount() > 0 ||
                studies().unmatchedRefPdfCount() > 0 ||
                studies().lookingUpRefPdfs() ||
                studies().foundPdfCount() > 0
              }
            >
              <div class='flex flex-wrap items-center gap-3 text-xs'>
                <Show when={studies().lookingUpRefPdfs()}>
                  <span class='inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-700'>
                    <div class='h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
                    Looking up PDFs...
                  </span>
                </Show>
                <Show when={studies().matchedRefPdfCount() > 0}>
                  <span class='inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-green-700'>
                    <BiRegularLinkAlt class='h-3 w-3' />
                    {studies().matchedRefPdfCount()} PDF
                    {studies().matchedRefPdfCount() > 1 ? 's' : ''} matched
                  </span>
                </Show>
                <Show when={studies().foundPdfCount() > 0}>
                  <span class='inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700'>
                    <CgFileDocument class='h-3 w-3' />
                    {studies().foundPdfCount()} open access
                  </span>
                </Show>
                <Show when={studies().unmatchedRefPdfCount() > 0}>
                  <span class='inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700'>
                    <CgFileDocument class='h-3 w-3' />
                    {studies().unmatchedRefPdfCount()} PDF
                    {studies().unmatchedRefPdfCount() > 1 ? 's' : ''} unmatched
                  </span>
                </Show>
              </div>
            </Show>

            <div class='flex items-center gap-2 border-b border-gray-200 pb-2'>
              <Checkbox
                checked={studies().selectedRefIds().size === studies().importedRefs().length}
                indeterminate={
                  studies().selectedRefIds().size > 0 &&
                  studies().selectedRefIds().size < studies().importedRefs().length
                }
                onChange={studies().toggleSelectAllRefs}
                label={`Select all (${studies().selectedRefIds().size}/${studies().importedRefs().length})`}
              />
            </div>

            <div class='max-h-48 space-y-1 overflow-y-auto pr-1'>
              <For each={studies().importedRefs()}>
                {ref => (
                  <div
                    class={`flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors ${
                      studies().selectedRefIds().has(ref._id) ?
                        'bg-blue-50 hover:bg-blue-100'
                      : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => studies().toggleRefSelection(ref._id)}
                  >
                    <Checkbox
                      checked={studies().selectedRefIds().has(ref._id)}
                      onChange={() => studies().toggleRefSelection(ref._id)}
                      class='mt-0.5'
                    />
                    <div class='min-w-0 flex-1'>
                      <div class='flex items-center gap-2'>
                        <p class='line-clamp-2 flex-1 text-sm font-medium text-gray-900'>
                          {ref.title}
                        </p>
                        <Show when={ref.pdfData}>
                          <span class='inline-flex shrink-0 items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700'>
                            <CgFileDocument class='h-3 w-3' />
                            PDF
                          </span>
                        </Show>
                        <Show when={!ref.pdfData && ref.pdfAvailable}>
                          <span
                            class={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
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
                            <BiRegularLinkAlt class='h-3 w-3' />
                            {ref.pdfAccessible ? 'OA' : 'PDF'}
                          </span>
                        </Show>
                      </div>
                      <p class='mt-0.5 text-xs text-gray-500'>
                        {getRefDisplayName(ref)}
                        <Show when={ref.journal}>
                          <span class='mx-1'>-</span>
                          <span class='italic'>{ref.journal}</span>
                        </Show>
                        <Show when={ref.pdfFileName}>
                          <span class='mx-1'>-</span>
                          <span class='inline-block max-w-32 truncate align-bottom text-green-600'>
                            {ref.pdfFileName}
                          </span>
                        </Show>
                        <Show when={!ref.pdfData && ref.pdfSource}>
                          <span class='mx-1'>-</span>
                          <span class='text-emerald-600'>{ref.pdfSource}</span>
                        </Show>
                      </p>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        }
      >
        <p class='text-sm text-gray-500'>
          Import references from Zotero, EndNote, Mendeley, or other reference managers. You can
          also drop PDFs alongside your reference file to automatically match them.
        </p>

        <FileUpload
          accept={MIXED_IMPORT_ACCEPT}
          multiple={true}
          onFilesChange={studies().handleRefFileSelect}
          showFileList={false}
          helpText='RIS, EndNote, BibTeX, or PDF files'
          compact
        />

        <div class='text-xs text-gray-500'>
          <p class='mb-1 font-medium'>Supported formats:</p>
          <ul class='list-inside list-disc space-y-0.5'>
            <For each={SUPPORTED_FORMATS}>
              {format => (
                <li>
                  <span class='font-medium'>{format.extension}</span> - {format.description}
                </li>
              )}
            </For>
          </ul>
          <p class='mt-2 text-gray-400'>
            Tip: Drop a folder from your reference manager to import references and PDFs together.
          </p>
        </div>

        <Show when={studies().parsingRefs()}>
          <div class='flex items-center justify-center gap-2 py-4 text-gray-500'>
            <div class='h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
            <span>Parsing references...</span>
          </div>
        </Show>
      </Show>
    </div>
  );
}
