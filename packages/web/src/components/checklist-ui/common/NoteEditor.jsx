/**
 * NoteEditor - Y.Text-bound textarea for editing notes
 *
 * This component binds directly to a Y.Text instance for real-time
 * collaborative editing. Changes sync automatically via Yjs.
 */
import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { BsJournalText } from 'solid-icons/bs';
import { Collapsible } from '@corates/ui';

const MAX_HEIGHT = 300;

/**
 * @param {Object} props
 * @param {Y.Text} props.yText - The Y.Text instance to bind to
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.readOnly] - Whether the editor is read-only
 * @param {boolean} [props.collapsed] - Start collapsed (default: true)
 * @param {number} [props.maxLength] - Maximum character limit (default: 2000)
 * @param {string} [props.label] - Label for the collapsible section
 */
export default function NoteEditor(props) {
  // Initialize expanded state - default to collapsed unless props.collapsed is false
  // eslint-disable-next-line solid/reactivity -- intentionally read once for initial state
  const [expanded, setExpanded] = createSignal(!props.collapsed);
  const [localValue, setLocalValue] = createSignal('');
  let textareaRef;

  // Initialize from Y.Text and set up observer
  createEffect(() => {
    const yText = props.yText;
    if (!yText) {
      setLocalValue('');
      return;
    }

    // Get initial value
    setLocalValue(yText.toString());

    // Observe changes from other users
    const observer = () => {
      setLocalValue(yText.toString());
    };

    yText.observe(observer);

    onCleanup(() => {
      yText.unobserve(observer);
    });
  });

  // Handle local input
  function handleInput(e) {
    const newValue = e.target.value;
    const maxLength = props.maxLength ?? 2000;

    // Enforce max length
    if (newValue.length > maxLength) {
      e.target.value = newValue.slice(0, maxLength);
      return;
    }

    // Immediate resize for snappier feel
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, MAX_HEIGHT)}px`;

    const yText = props.yText;
    if (!yText || props.readOnly) return;

    // Update Y.Text - delete all and insert new content in a transaction
    // to avoid intermediate empty states that cause UI flickering
    yText.doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, newValue);
    });
  }

  // Auto-resize textarea as content changes
  createEffect(() => {
    const isExpanded = expanded();
    if (textareaRef && isExpanded) {
      // Reset height to auto to get correct scrollHeight
      textareaRef.style.height = 'auto';
      // Set height to scrollHeight, capped at MAX_HEIGHT
      textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, MAX_HEIGHT)}px`;
    }
  });

  const hasContent = () => localValue().trim().length > 0;
  const charCount = () => localValue().length;
  const maxLength = () => props.maxLength ?? 2000;

  return (
    <div class='mt-3 border-t border-gray-100 pt-2'>
      <Collapsible
        open={expanded()}
        onOpenChange={setExpanded}
        trigger={api => (
          <div
            {...api.getTriggerProps()}
            class={`
              flex items-center gap-1.5 py-1 text-xs cursor-pointer select-none
              ${hasContent() ? 'text-blue-600 hover:text-blue-700' : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <BiRegularChevronRight
              class={`w-4 h-4 shrink-0 transition-transform duration-200 ${expanded() ? 'rotate-90' : ''}`}
            />
            <BsJournalText class='w-3 h-3 shrink-0' />
            <span class='font-medium'>{props.label || 'Notes'}</span>
          </div>
        )}
      >
        <div class='pt-2 px-0.5 pb-0.5'>
          <textarea
            ref={textareaRef}
            value={localValue()}
            onInput={handleInput}
            placeholder={props.placeholder || 'Add a note for this question...'}
            disabled={props.readOnly || !props.yText}
            class={`
              w-full px-3 py-2 text-sm border rounded-lg resize-none overflow-hidden
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              ${props.readOnly ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : 'bg-white text-gray-900'}
              ${!props.yText ? 'bg-gray-100 cursor-not-allowed' : ''}
            `}
            style={{ 'min-height': '60px' }}
            maxLength={maxLength()}
          />
          <div class='flex justify-between items-center mt-1 text-2xs text-gray-400'>
            <span>{props.readOnly ? 'Read-only' : ''}</span>
            <span class={charCount() > maxLength() * 0.9 ? 'text-amber-500' : ''}>
              {charCount()} / {maxLength()}
            </span>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

/**
 * Read-only note display for reconciliation view
 * Shows the note content without editing capabilities
 */
export function NoteDisplay(props) {
  const hasContent = () => (props.content || '').trim().length > 0;

  return (
    <Show when={hasContent()}>
      <div class='mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100'>
        <div class='flex items-center gap-1.5 text-xs text-gray-500 mb-1'>
          <BsJournalText class='w-3 h-3' />
          <span>Notes</span>
        </div>
        <p class='text-sm text-gray-700 whitespace-pre-wrap'>{props.content}</p>
      </div>
    </Show>
  );
}
