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
import NoteEditor from '@checklist-ui/common/NoteEditor.jsx';

const MAX_LENGTH = 2000;

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
  const [hasFinalNote, setHasFinalNote] = createSignal(false);

  const hasReviewer1Note = () => (props.reviewer1Note || '').trim().length > 0;
  const hasReviewer2Note = () => (props.reviewer2Note || '').trim().length > 0;

  // Track final note content reactively
  createEffect(() => {
    const yText = props.finalNoteYText;
    if (!yText) {
      setHasFinalNote(false);
      return;
    }

    // Update initial state
    setHasFinalNote(yText.toString().trim().length > 0);

    // Observe changes
    const observer = () => {
      setHasFinalNote(yText.toString().trim().length > 0);
    };

    yText.observe(observer);

    onCleanup(() => {
      yText.unobserve(observer);
    });
  });

  const hasAnyNote = () => hasReviewer1Note() || hasReviewer2Note() || hasFinalNote();

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
            class={`flex cursor-pointer items-center gap-1.5 py-1 text-sm select-none ${hasAnyNote() ? 'text-blue-600 hover:text-blue-700' : 'text-gray-500 hover:text-gray-700'} `}
          >
            <BiRegularChevronRight
              class={`h-4 w-4 shrink-0 transition-transform duration-200 ${expanded() ? 'rotate-90' : ''}`}
            />
            <BsJournalText class='h-4 w-4 shrink-0' />
            <span class='font-medium'>Question Notes</span>
            <Show when={hasAnyNote()}>
              <span class='ml-1 text-xs text-gray-400'>
                (
                {[hasReviewer1Note() && 'R1', hasReviewer2Note() && 'R2', hasFinalNote() && 'Final']
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
            <div class='rounded-lg bg-gray-50 p-3'>
              <div class='mb-2 flex items-center justify-between'>
                <h4 class='text-xs font-semibold text-gray-700'>
                  {props.reviewer1Name || 'Reviewer 1'}
                </h4>
                <Show when={hasReviewer1Note()}>
                  <button
                    onClick={() => copyToFinal(props.reviewer1Note)}
                    class='flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800'
                    title='Copy to final note'
                  >
                    <BsClipboard2 class='h-3 w-3' />
                    Use
                  </button>
                </Show>
              </div>
              <Show
                when={hasReviewer1Note()}
                fallback={<p class='text-xs text-gray-400 italic'>No note added</p>}
              >
                <p class='wrap-break-words text-sm whitespace-pre-wrap text-gray-700'>
                  {props.reviewer1Note}
                </p>
              </Show>
            </div>

            {/* Reviewer 2 Note (read-only) */}
            <div class='rounded-lg bg-gray-50 p-3'>
              <div class='mb-2 flex items-center justify-between'>
                <h4 class='text-xs font-semibold text-gray-700'>
                  {props.reviewer2Name || 'Reviewer 2'}
                </h4>
                <Show when={hasReviewer2Note()}>
                  <button
                    onClick={() => copyToFinal(props.reviewer2Note)}
                    class='flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800'
                    title='Copy to final note'
                  >
                    <BsClipboard2 class='h-3 w-3' />
                    Use
                  </button>
                </Show>
              </div>
              <Show
                when={hasReviewer2Note()}
                fallback={<p class='text-xs text-gray-400 italic'>No note added</p>}
              >
                <p class='wrap-break-words text-sm whitespace-pre-wrap text-gray-700'>
                  {props.reviewer2Note}
                </p>
              </Show>
            </div>

            {/* Final Note (editable) */}
            <div class='rounded-lg bg-green-50/50 p-3'>
              <div class='mb-2 flex items-center justify-between'>
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
                <NoteEditor
                  yText={props.finalNoteYText}
                  inline={true}
                  placeholder='Add the final reconciled note...'
                  maxLength={MAX_LENGTH}
                  focusRingColor='green-500'
                />
              </Show>
            </div>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
