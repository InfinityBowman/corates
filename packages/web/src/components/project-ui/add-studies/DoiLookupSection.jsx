/**
 * DoiLookupSection - DOI/PMID lookup section for AddStudiesForm
 * Handles identifier input, lookup, and result selection
 * Only allows selecting references that have PDFs available (via Unpaywall)
 */

import { For, Show, createMemo } from 'solid-js';
import { BiRegularTrash, BiRegularSearch, BiRegularLinkExternal } from 'solid-icons/bi';
import { FiFile, FiFileText, FiAlertCircle } from 'solid-icons/fi';
import { Checkbox } from '@components/zag/Checkbox.jsx';
import { Tooltip } from '@components/zag/Tooltip.jsx';
import { getRefDisplayName } from '@/lib/referenceParser.js';

/**
 * @param {Object} props
 * @param {Function} props.identifierInput - Signal getter for input text
 * @param {Function} props.setIdentifierInput - Signal setter for input text
 * @param {Function} props.lookupRefs - Signal getter for looked up references
 * @param {Function} props.selectedLookupIds - Signal getter for selected IDs (Set)
 * @param {Function} props.lookingUp - Signal getter for loading state
 * @param {Function} props.lookupErrors - Signal getter for errors array
 * @param {Function} props.onLookup - Handler for lookup action
 * @param {Function} props.onToggleSelection - Handler to toggle ref selection (id)
 * @param {Function} props.onToggleSelectAll - Handler to toggle all selections
 * @param {Function} props.onRemove - Handler to remove a single ref (id)
 * @param {Function} props.onClear - Handler to clear all refs
 */
export default function DoiLookupSection(props) {
  // Count refs with PDFs available
  const refsWithPdf = createMemo(() => props.lookupRefs().filter(r => r.pdfAvailable));
  const refsWithoutPdf = createMemo(() => props.lookupRefs().filter(r => !r.pdfAvailable));

  return (
    <div class='space-y-3'>
      <p class='text-sm text-gray-500'>
        Paste DOIs or PubMed IDs to find references with open-access PDFs. Only references with
        available PDFs can be added.
      </p>

      <div class='space-y-2'>
        <textarea
          placeholder='10.1000/xyz123&#10;32615397&#10;10.1016/j.example.2023.01.001'
          value={props.identifierInput()}
          onInput={e => props.setIdentifierInput(e.target.value)}
          rows='4'
          class='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono'
        />
        <button
          type='button'
          onClick={() => props.onLookup()}
          disabled={props.lookingUp() || !props.identifierInput().trim()}
          class='inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'
        >
          <Show
            when={!props.lookingUp()}
            fallback={
              <>
                <div class='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                Looking up...
              </>
            }
          >
            <BiRegularSearch class='w-4 h-4' />
            Look Up References
          </Show>
        </button>
      </div>

      <Show when={props.lookupErrors().length > 0}>
        <div class='bg-red-50 border border-red-200 rounded-lg p-3'>
          <p class='text-sm font-medium text-red-700 mb-1'>Some lookups failed:</p>
          <ul class='text-xs text-red-600 list-disc list-inside'>
            <For each={props.lookupErrors()}>
              {err => (
                <li>
                  <code class='font-mono'>{err.identifier}</code>: {err.error}
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>

      <Show when={props.lookupRefs().length > 0}>
        <div class='space-y-2'>
          <div class='flex items-center justify-between'>
            <span class='text-sm text-gray-600'>
              Found references:{' '}
              <span class='text-green-600 font-medium'>{refsWithPdf().length} with PDF</span>
              <Show when={refsWithoutPdf().length > 0}>
                <span class='text-gray-400 mx-1'>|</span>
                <span class='text-amber-600'>{refsWithoutPdf().length} without PDF</span>
              </Show>
            </span>
            <button
              type='button'
              onClick={() => props.onClear()}
              class='text-xs text-red-600 hover:text-red-700 hover:underline'
            >
              Clear all
            </button>
          </div>

          <Show when={refsWithPdf().length > 0}>
            <div class='flex items-center gap-2 pb-2 border-b border-gray-200'>
              <Checkbox
                checked={props.selectedLookupIds().size === refsWithPdf().length}
                indeterminate={
                  props.selectedLookupIds().size > 0 &&
                  props.selectedLookupIds().size < refsWithPdf().length
                }
                onChange={props.onToggleSelectAll}
                label={`Select all with PDF (${props.selectedLookupIds().size}/${refsWithPdf().length})`}
              />
            </div>
          </Show>

          <div class='max-h-64 overflow-y-auto space-y-1 pr-1'>
            {/* References with PDF available */}
            <For each={refsWithPdf()}>
              {ref => (
                <div
                  class={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    props.selectedLookupIds().has(ref._id) ?
                      'bg-green-50 hover:bg-green-100 border border-green-200'
                    : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                  }`}
                  onClick={() => props.onToggleSelection(ref._id)}
                >
                  <Checkbox
                    checked={props.selectedLookupIds().has(ref._id)}
                    onChange={() => props.onToggleSelection(ref._id)}
                    class='mt-0.5'
                  />
                  <div class='flex-1 min-w-0'>
                    <div class='flex items-start gap-2'>
                      <p class='text-sm font-medium text-gray-900 line-clamp-2 flex-1'>
                        {ref.title}
                      </p>
                      <div class='flex items-center gap-1 shrink-0'>
                        <Tooltip content={`PDF available via ${ref.pdfSource || 'open access'}`}>
                          <span class='inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium'>
                            <FiFileText class='w-3 h-3' />
                            PDF
                          </span>
                        </Tooltip>
                        <Show when={ref.pdfUrl}>
                          <Tooltip content='View PDF'>
                            <a
                              href={ref.pdfUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              onClick={e => e.stopPropagation()}
                              class='inline-flex items-center justify-center w-6 h-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors'
                            >
                              <BiRegularLinkExternal class='w-4 h-4' />
                            </a>
                          </Tooltip>
                        </Show>
                      </div>
                    </div>
                    <p class='text-xs text-gray-500 mt-0.5'>
                      {getRefDisplayName(ref)}
                      <Show when={ref.journal}>
                        <span class='mx-1'>-</span>
                        <span class='italic'>{ref.journal}</span>
                      </Show>
                    </p>
                    <Show when={ref.doi}>
                      <p class='text-xs text-blue-500 font-mono mt-0.5'>{ref.doi}</p>
                    </Show>
                  </div>
                  <button
                    type='button'
                    onClick={e => {
                      e.stopPropagation();
                      props.onRemove(ref._id);
                    }}
                    class='p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors'
                  >
                    <BiRegularTrash class='w-4 h-4' />
                  </button>
                </div>
              )}
            </For>

            {/* References without PDF - shown but not selectable */}
            <Show when={refsWithoutPdf().length > 0}>
              <div class='pt-2 mt-2 border-t border-gray-200'>
                <p class='text-xs text-amber-600 font-medium mb-2 flex items-center gap-1'>
                  <FiAlertCircle class='w-3.5 h-3.5' />
                  No open-access PDF available:
                </p>
                <For each={refsWithoutPdf()}>
                  {ref => (
                    <div class='flex items-start gap-3 p-2 rounded-lg bg-amber-50/50 border border-amber-100 opacity-75'>
                      <div class='w-5 h-5 flex items-center justify-center mt-0.5'>
                        <FiFile class='w-4 h-4 text-amber-400' />
                      </div>
                      <div class='flex-1 min-w-0'>
                        <p class='text-sm font-medium text-gray-700 line-clamp-2'>{ref.title}</p>
                        <p class='text-xs text-gray-500 mt-0.5'>
                          {getRefDisplayName(ref)}
                          <Show when={ref.journal}>
                            <span class='mx-1'>-</span>
                            <span class='italic'>{ref.journal}</span>
                          </Show>
                        </p>
                        <Show when={ref.doi}>
                          <div class='flex items-center gap-2 mt-1'>
                            <span class='text-xs text-gray-400 font-mono'>{ref.doi}</span>
                            <a
                              href={`https://doi.org/${ref.doi}`}
                              target='_blank'
                              rel='noopener noreferrer'
                              onClick={e => e.stopPropagation()}
                              class='text-xs text-blue-500 hover:text-blue-600 inline-flex items-center gap-0.5'
                            >
                              View <BiRegularLinkExternal class='w-3 h-3' />
                            </a>
                          </div>
                        </Show>
                      </div>
                      <button
                        type='button'
                        onClick={e => {
                          e.stopPropagation();
                          props.onRemove(ref._id);
                        }}
                        class='p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors'
                      >
                        <BiRegularTrash class='w-4 h-4' />
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
