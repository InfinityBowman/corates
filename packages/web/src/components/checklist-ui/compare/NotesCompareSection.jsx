/**
 * NotesCompareSection - Side-by-side note comparison for reconciliation view
 *
 * Shows reviewer 1 and reviewer 2 notes (read-only) and allows editing the final note.
 * Supports copying reviewer notes to the final note for convenience.
 */
import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { BsJournalText, BsClipboard2 } from 'solid-icons/bs';
import { Collapsible } from '@corates/ui';

const MAX_LENGTH = 2000;
const MAX_HEIGHT = 200;

/**
 * @param {Object} props
 * @param {string} props.reviewer1Note - Text content of reviewer 1's note
 * @param {string} props.reviewer2Note - Text content of reviewer 2's note
 * @param {Y.Text} props.finalNoteYText - Y.Text instance for the final/reconciled note
 * @param {string} props.reviewer1Name - Display name for reviewer 1
 * @param {string} props.reviewer2Name - Display name for reviewer 2
 * @param {boolean} [props.collapsed] - Start collapsed (default: true)
 */
export default function NotesCompareSection(props) {
  // eslint-disable-next-line solid/reactivity -- intentionally read once for initial state
  const [expanded, setExpanded] = createSignal(!props.collapsed);
  const [finalNoteText, setFinalNoteText] = createSignal('');
  let textareaRef;

  const hasReviewer1Note = () => (props.reviewer1Note || '').trim().length > 0;
  const hasReviewer2Note = () => (props.reviewer2Note || '').trim().length > 0;
  const hasAnyNote = () =>
    hasReviewer1Note() || hasReviewer2Note() || finalNoteText().trim().length > 0;

  // Initialize from Y.Text and set up observer
  createEffect(() => {
    const yText = props.finalNoteYText;
    if (!yText) {
      setFinalNoteText('');
      return;
    }

    // Get initial value
    setFinalNoteText(yText.toString());

    // Observe changes from other users
    const observer = () => {
      setFinalNoteText(yText.toString());
    };

    yText.observe(observer);

    onCleanup(() => {
      yText.unobserve(observer);
    });
  });

  // Auto-resize textarea
  createEffect(() => {
    // Read finalNoteText to track text changes
    finalNoteText();
    if (textareaRef && expanded()) {
      textareaRef.style.height = 'auto';
      textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, MAX_HEIGHT)}px`;
    }
  });

  // Handle input for final note
  function handleFinalNoteInput(e) {
    const newValue = e.target.value;

    // Enforce max length
    if (newValue.length > MAX_LENGTH) {
      e.target.value = newValue.slice(0, MAX_LENGTH);
      return;
    }

    // Resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, MAX_HEIGHT)}px`;

    const yText = props.finalNoteYText;
    if (!yText) return;

    // Update Y.Text
    yText.doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, newValue);
    });
  }

  // Copy reviewer note to final note
  function copyToFinal(sourceNote) {
    const yText = props.finalNoteYText;
    if (!yText || !sourceNote) return;

    const text = sourceNote.slice(0, MAX_LENGTH);
    yText.doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, text);
    });
  }

  // Merge both notes into final
  function mergeToFinal() {
    const yText = props.finalNoteYText;
    if (!yText) return;

    const parts = [];
    if (hasReviewer1Note()) {
      parts.push(`[${props.reviewer1Name || 'Reviewer 1'}]\n${props.reviewer1Note}`);
    }
    if (hasReviewer2Note()) {
      parts.push(`[${props.reviewer2Name || 'Reviewer 2'}]\n${props.reviewer2Note}`);
    }

    const merged = parts.join('\n\n').slice(0, MAX_LENGTH);
    yText.doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, merged);
    });
  }

  return (
    <div class='mt-4 border-t border-gray-200 pt-3'>
      <Collapsible
        open={expanded()}
        onOpenChange={setExpanded}
        trigger={api => (
          <div
            {...api.getTriggerProps()}
            class={`
              flex items-center gap-1.5 py-1 text-sm cursor-pointer select-none
              ${hasAnyNote() ? 'text-blue-600 hover:text-blue-700' : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <BiRegularChevronRight
              class={`w-4 h-4 shrink-0 transition-transform duration-200 ${expanded() ? 'rotate-90' : ''}`}
            />
            <BsJournalText class='w-4 h-4 shrink-0' />
            <span class='font-medium'>Question Notes</span>
            <Show when={hasAnyNote()}>
              <span class='text-xs text-gray-400 ml-1'>
                (
                {[
                  hasReviewer1Note() && 'R1',
                  hasReviewer2Note() && 'R2',
                  finalNoteText().trim() && 'Final',
                ]
                  .filter(Boolean)
                  .join(', ')}
                )
              </span>
            </Show>
          </div>
        )}
      >
        <div class='pt-3'>
          {/* Three column layout for notes */}
          <div class='grid grid-cols-3 gap-4'>
            {/* Reviewer 1 Note (read-only) */}
            <div class='bg-gray-50 rounded-lg p-3'>
              <div class='flex items-center justify-between mb-2'>
                <h4 class='text-xs font-semibold text-gray-700'>
                  {props.reviewer1Name || 'Reviewer 1'}
                </h4>
                <Show when={hasReviewer1Note()}>
                  <button
                    onClick={() => copyToFinal(props.reviewer1Note)}
                    class='text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1'
                    title='Copy to final note'
                  >
                    <BsClipboard2 class='w-3 h-3' />
                    Use
                  </button>
                </Show>
              </div>
              <Show
                when={hasReviewer1Note()}
                fallback={<p class='text-xs text-gray-400 italic'>No note added</p>}
              >
                <p class='text-sm text-gray-700 whitespace-pre-wrap wrap-break-words'>
                  {props.reviewer1Note}
                </p>
              </Show>
            </div>

            {/* Reviewer 2 Note (read-only) */}
            <div class='bg-gray-50 rounded-lg p-3'>
              <div class='flex items-center justify-between mb-2'>
                <h4 class='text-xs font-semibold text-gray-700'>
                  {props.reviewer2Name || 'Reviewer 2'}
                </h4>
                <Show when={hasReviewer2Note()}>
                  <button
                    onClick={() => copyToFinal(props.reviewer2Note)}
                    class='text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1'
                    title='Copy to final note'
                  >
                    <BsClipboard2 class='w-3 h-3' />
                    Use
                  </button>
                </Show>
              </div>
              <Show
                when={hasReviewer2Note()}
                fallback={<p class='text-xs text-gray-400 italic'>No note added</p>}
              >
                <p class='text-sm text-gray-700 whitespace-pre-wrap wrap-break-words'>
                  {props.reviewer2Note}
                </p>
              </Show>
            </div>

            {/* Final Note (editable) */}
            <div class='bg-green-50/50 rounded-lg p-3'>
              <div class='flex items-center justify-between mb-2'>
                <h4 class='text-xs font-semibold text-gray-700'>Final Note</h4>
                <Show when={hasReviewer1Note() && hasReviewer2Note()}>
                  <button
                    onClick={mergeToFinal}
                    class='text-xs text-green-600 hover:text-green-800'
                    title='Merge both notes'
                  >
                    Merge Both
                  </button>
                </Show>
              </div>
              <Show
                when={props.finalNoteYText}
                fallback={<p class='text-xs text-gray-400 italic'>Loading...</p>}
              >
                <textarea
                  ref={textareaRef}
                  value={finalNoteText()}
                  onInput={handleFinalNoteInput}
                  placeholder='Add the final reconciled note...'
                  class='w-full px-3 py-2 text-sm border rounded-lg resize-none overflow-hidden bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent'
                  style={{ 'min-height': '60px' }}
                  maxLength={MAX_LENGTH}
                />
                <div class='flex justify-end mt-1 text-2xs text-gray-400'>
                  <span class={finalNoteText().length > MAX_LENGTH * 0.9 ? 'text-amber-500' : ''}>
                    {finalNoteText().length} / {MAX_LENGTH}
                  </span>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
