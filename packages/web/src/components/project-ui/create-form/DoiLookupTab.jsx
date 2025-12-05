import { For, Show } from 'solid-js';
import { BiRegularTrash, BiRegularSearch } from 'solid-icons/bi';
import { Checkbox } from '@components/zag/Checkbox.jsx';
import { getRefDisplayName } from '@/lib/referenceParser.js';

/**
 * DOI/PMID lookup tab for project creation form
 * @param {Object} props
 * @param {Function} props.identifierInput - Signal getter for input text
 * @param {Function} props.setIdentifierInput - Signal setter for input text
 * @param {Function} props.lookupRefs - Signal getter for looked up references
 * @param {Function} props.selectedLookupIds - Signal getter for selected IDs
 * @param {Function} props.lookingUp - Signal getter for loading state
 * @param {Function} props.lookupErrors - Signal getter for errors
 * @param {Function} props.onLookup - Handler for lookup action
 * @param {Function} props.onToggleSelection - Handler to toggle ref selection
 * @param {Function} props.onToggleSelectAll - Handler to toggle all selections
 * @param {Function} props.onRemove - Handler to remove a single ref
 * @param {Function} props.onClear - Handler to clear all refs
 */
export default function DoiLookupTab(props) {
  return (
    <div class='space-y-3'>
      <p class='text-sm text-gray-500'>
        Paste DOIs or PubMed IDs to quickly add references. Enter one identifier per line.
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

      {/* Lookup errors */}
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

      {/* Lookup results */}
      <Show when={props.lookupRefs().length > 0}>
        <div class='space-y-2'>
          <div class='flex items-center justify-between'>
            <span class='text-sm text-gray-600'>Found references:</span>
            <button
              type='button'
              onClick={() => props.onClear()}
              class='text-xs text-red-600 hover:text-red-700 hover:underline'
            >
              Clear all
            </button>
          </div>

          {/* Select all checkbox */}
          <div class='flex items-center gap-2 pb-2 border-b border-gray-200'>
            <Checkbox
              checked={props.selectedLookupIds().size === props.lookupRefs().length}
              indeterminate={
                props.selectedLookupIds().size > 0 &&
                props.selectedLookupIds().size < props.lookupRefs().length
              }
              onChange={props.onToggleSelectAll}
              label={`Select all (${props.selectedLookupIds().size}/${props.lookupRefs().length})`}
            />
          </div>

          {/* Lookup refs list */}
          <div class='max-h-48 overflow-y-auto space-y-1 pr-1'>
            <For each={props.lookupRefs()}>
              {ref => (
                <div
                  class={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    props.selectedLookupIds().has(ref._id) ?
                      'bg-blue-50 hover:bg-blue-100'
                    : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => props.onToggleSelection(ref._id)}
                >
                  <Checkbox
                    checked={props.selectedLookupIds().has(ref._id)}
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
          </div>
        </div>
      </Show>
    </div>
  );
}
