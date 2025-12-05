import { For, Show } from 'solid-js';
import { AiOutlineFileText } from 'solid-icons/ai';
import { FileUpload } from '@components/zag/FileUpload.jsx';
import { Checkbox } from '@components/zag/Checkbox.jsx';
import { getRefDisplayName, SUPPORTED_FORMATS } from '@/lib/referenceParser.js';

/**
 * Reference file import tab for project creation form
 * @param {Object} props
 * @param {Function} props.importedRefs - Signal getter for imported references
 * @param {Function} props.selectedRefIds - Signal getter for selected reference IDs
 * @param {Function} props.refFileName - Signal getter for reference file name
 * @param {Function} props.parsingRefs - Signal getter for parsing state
 * @param {Function} props.onFileSelect - Handler for file selection
 * @param {Function} props.onToggleSelection - Handler to toggle ref selection
 * @param {Function} props.onToggleSelectAll - Handler to toggle all selections
 * @param {Function} props.onClear - Handler to clear imported refs
 */
export default function ReferenceImportTab(props) {
  return (
    <div class='space-y-3'>
      <Show
        when={props.importedRefs().length === 0}
        fallback={
          <div class='space-y-3'>
            {/* File info and change button */}
            <div class='flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2'>
              <div class='flex items-center gap-2 text-sm text-gray-600'>
                <AiOutlineFileText class='w-4 h-4' />
                <span class='truncate max-w-48'>{props.refFileName()}</span>
                <span class='text-gray-400'>({props.importedRefs().length} references)</span>
              </div>
              <button
                type='button'
                onClick={() => props.onClear()}
                class='text-xs text-blue-600 hover:text-blue-700 font-medium'
              >
                Change file
              </button>
            </div>

            {/* Select all checkbox */}
            <div class='flex items-center gap-2 pb-2 border-b border-gray-200'>
              <Checkbox
                checked={props.selectedRefIds().size === props.importedRefs().length}
                indeterminate={
                  props.selectedRefIds().size > 0 &&
                  props.selectedRefIds().size < props.importedRefs().length
                }
                onChange={props.onToggleSelectAll}
                label={`Select all (${props.selectedRefIds().size}/${props.importedRefs().length})`}
              />
            </div>

            {/* References list */}
            <div class='max-h-48 overflow-y-auto space-y-1 pr-1'>
              <For each={props.importedRefs()}>
                {ref => (
                  <div
                    class={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      props.selectedRefIds().has(ref._id) ?
                        'bg-blue-50 hover:bg-blue-100'
                      : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => props.onToggleSelection(ref._id)}
                  >
                    <Checkbox
                      checked={props.selectedRefIds().has(ref._id)}
                      onChange={() => props.onToggleSelection(ref._id)}
                      class='mt-0.5'
                    />
                    <div class='flex-1 min-w-0'>
                      <p class='text-sm font-medium text-gray-900 line-clamp-2'>{ref.title}</p>
                      <p class='text-xs text-gray-500 mt-0.5'>
                        {getRefDisplayName(ref)}
                        <Show when={ref.journal}>
                          <span class='mx-1'>-</span>
                          <span class='italic'>{ref.journal}</span>
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
          Import references from Zotero, EndNote, Mendeley, or other reference managers.
        </p>

        <FileUpload
          accept='.ris,.enw,.bib,.bibtex'
          multiple={false}
          onFilesChange={props.onFileSelect}
          showFileList={false}
          helpText='RIS, EndNote, or BibTeX format'
          compact
        />

        {/* Supported formats info */}
        <div class='text-xs text-gray-500'>
          <p class='font-medium mb-1'>Supported formats:</p>
          <ul class='list-disc list-inside space-y-0.5'>
            <For each={SUPPORTED_FORMATS}>
              {format => (
                <li>
                  <span class='font-medium'>{format.extension}</span> - {format.description}
                </li>
              )}
            </For>
          </ul>
        </div>

        {/* Parsing indicator */}
        <Show when={props.parsingRefs()}>
          <div class='flex items-center justify-center gap-2 py-4 text-gray-500'>
            <div class='w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
            <span>Parsing references...</span>
          </div>
        </Show>
      </Show>
    </div>
  );
}
