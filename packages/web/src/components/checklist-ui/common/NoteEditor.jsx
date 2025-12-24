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
 * @param {boolean} [props.inline] - Render without collapsible wrapper (default: false)
 * @param {string} [props.focusRingColor] - Focus ring color class (default: 'blue-500')
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
    const isExpanded = props.inline ? true : expanded();
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

  // Get focus ring color class
  const getFocusRingClass = () => {
    const color = props.focusRingColor || 'blue-500';
    const colorMap = {
      'blue-500': 'focus:ring-blue-500',
      'green-500': 'focus:ring-green-500',
    };
    return colorMap[color] || 'focus:ring-blue-500';
  };

  // Render textarea content (shared between inline and collapsible modes)
  const textareaContent = (
    <>
      <textarea
        ref={textareaRef}
        value={localValue()}
        onInput={handleInput}
        placeholder={props.placeholder || 'Add a note for this question...'}
        disabled={props.readOnly || !props.yText}
        class={`w-full resize-none overflow-hidden rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:outline-none ${getFocusRingClass()} ${props.readOnly ? 'cursor-not-allowed bg-gray-50 text-gray-600' : 'bg-white text-gray-900'} ${!props.yText ? 'cursor-not-allowed bg-gray-100' : ''}`}
        style={{ 'min-height': '60px' }}
        maxLength={maxLength()}
      />
      <div class='text-2xs mt-1 flex items-center justify-between text-gray-400'>
        <span>{props.readOnly ? 'Read-only' : ''}</span>
        <span class={charCount() > maxLength() * 0.9 ? 'text-amber-500' : ''}>
          {charCount()} / {maxLength()}
        </span>
      </div>
    </>
  );

  return (
    <Show
      when={props.inline}
      fallback={
        <div class='mt-3 border-t border-gray-100 pt-2'>
          <Collapsible
            open={expanded()}
            onOpenChange={({ open }) => setExpanded(open)}
            trigger={
              <div
                class={`flex cursor-pointer items-center gap-1.5 py-1 text-xs select-none ${hasContent() ? 'text-blue-600 hover:text-blue-700' : 'text-gray-500 hover:text-gray-700'} `}
              >
                <BiRegularChevronRight
                  class={`h-4 w-4 shrink-0 transition-transform duration-200 ${expanded() ? 'rotate-90' : ''}`}
                />
                <BsJournalText class='h-3 w-3 shrink-0' />
                <span class='font-medium'>{props.label || 'Notes'}</span>
              </div>
            }
          >
            <div class='px-0.5 pt-2 pb-0.5'>{textareaContent}</div>
          </Collapsible>
        </div>
      }
    >
      <div>{textareaContent}</div>
    </Show>
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
      <div class='mt-2 rounded-lg border border-gray-100 bg-gray-50 p-2'>
        <div class='mb-1 flex items-center gap-1.5 text-xs text-gray-500'>
          <BsJournalText class='h-3 w-3' />
          <span>Notes</span>
        </div>
        <p class='text-sm whitespace-pre-wrap text-gray-700'>{props.content}</p>
      </div>
    </Show>
  );
}
