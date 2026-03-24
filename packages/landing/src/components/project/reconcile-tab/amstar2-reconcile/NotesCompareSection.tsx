/**
 * NotesCompareSection - Side-by-side note comparison for reconciliation view
 *
 * Shows reviewer 1 and reviewer 2 notes (read-only) and allows editing the final note.
 * Supports copying reviewer notes to the final note for convenience.
 */

import { useState } from 'react';
import { ChevronRightIcon, BookOpenIcon, ClipboardIcon } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import { useYText } from '@/hooks/useYText';

const MAX_LENGTH = 2000;

interface NotesCompareSectionProps {
  reviewer1Note: string;
  reviewer2Note: string;
  finalNoteYText: any;
  reviewer1Name: string;
  reviewer2Name: string;
  collapsed?: boolean;
}

export function NotesCompareSection({
  reviewer1Note,
  reviewer2Note,
  finalNoteYText,
  reviewer1Name,
  reviewer2Name,
  collapsed = true,
}: NotesCompareSectionProps) {
  const [expanded, setExpanded] = useState(!collapsed);
  const finalNoteText = useYText(finalNoteYText);

  const hasReviewer1Note = (reviewer1Note || '').trim().length > 0;
  const hasReviewer2Note = (reviewer2Note || '').trim().length > 0;
  const hasFinalNote = finalNoteText.trim().length > 0;
  const hasAnyNote = hasReviewer1Note || hasReviewer2Note || hasFinalNote;

  function copyToFinal(sourceNote: string) {
    if (!finalNoteYText || !sourceNote) return;
    const text = sourceNote.slice(0, MAX_LENGTH);
    finalNoteYText.doc.transact(() => {
      finalNoteYText.delete(0, finalNoteYText.length);
      finalNoteYText.insert(0, text);
    });
  }

  function mergeToFinal() {
    if (!finalNoteYText) return;
    const parts: string[] = [];
    if (hasReviewer1Note) {
      parts.push(`[${reviewer1Name || 'Reviewer 1'}]\n${reviewer1Note}`);
    }
    if (hasReviewer2Note) {
      parts.push(`[${reviewer2Name || 'Reviewer 2'}]\n${reviewer2Note}`);
    }
    const merged = parts.join('\n\n').slice(0, MAX_LENGTH);
    finalNoteYText.doc.transact(() => {
      finalNoteYText.delete(0, finalNoteYText.length);
      finalNoteYText.insert(0, merged);
    });
  }

  return (
    <div className='border-border mt-4 border-t pt-3'>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger
          className={`flex cursor-pointer items-center gap-1.5 py-1 text-sm select-none ${hasAnyNote ? 'text-blue-600 hover:text-blue-700' : 'text-muted-foreground hover:text-secondary-foreground'}`}
        >
          <ChevronRightIcon
            className={`size-4 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
          <BookOpenIcon className='size-4 shrink-0' />
          <span className='font-medium'>Question Notes</span>
          {hasAnyNote && (
            <span className='text-muted-foreground/70 ml-1 text-xs'>
              (
              {[hasReviewer1Note && 'R1', hasReviewer2Note && 'R2', hasFinalNote && 'Final']
                .filter(Boolean)
                .join(', ')}
              )
            </span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className='pt-3'>
            <div className='grid grid-cols-3 gap-4'>
              {/* Reviewer 1 Note (read-only) */}
              <div className='bg-muted rounded-lg p-3'>
                <div className='mb-2 flex items-center justify-between'>
                  <h4 className='text-secondary-foreground text-xs font-semibold'>
                    {reviewer1Name || 'Reviewer 1'}
                  </h4>
                  {hasReviewer1Note && (
                    <button
                      onClick={() => copyToFinal(reviewer1Note)}
                      className='flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800'
                      title='Copy to final note'
                    >
                      <ClipboardIcon className='size-3' />
                      Use
                    </button>
                  )}
                </div>
                {hasReviewer1Note ?
                  <p className='wrap-break-words text-secondary-foreground text-sm whitespace-pre-wrap'>
                    {reviewer1Note}
                  </p>
                : <p className='text-muted-foreground/70 text-xs italic'>No note added</p>}
              </div>

              {/* Reviewer 2 Note (read-only) */}
              <div className='bg-muted rounded-lg p-3'>
                <div className='mb-2 flex items-center justify-between'>
                  <h4 className='text-secondary-foreground text-xs font-semibold'>
                    {reviewer2Name || 'Reviewer 2'}
                  </h4>
                  {hasReviewer2Note && (
                    <button
                      onClick={() => copyToFinal(reviewer2Note)}
                      className='flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800'
                      title='Copy to final note'
                    >
                      <ClipboardIcon className='size-3' />
                      Use
                    </button>
                  )}
                </div>
                {hasReviewer2Note ?
                  <p className='wrap-break-words text-secondary-foreground text-sm whitespace-pre-wrap'>
                    {reviewer2Note}
                  </p>
                : <p className='text-muted-foreground/70 text-xs italic'>No note added</p>}
              </div>

              {/* Final Note (editable) */}
              <div className='rounded-lg bg-green-50/50 p-3'>
                <div className='mb-2 flex items-center justify-between'>
                  <h4 className='text-secondary-foreground text-xs font-semibold'>Final Note</h4>
                  {hasReviewer1Note && hasReviewer2Note && (
                    <button
                      onClick={mergeToFinal}
                      className='text-xs text-green-600 hover:text-green-800'
                      title='Merge both notes'
                    >
                      Merge Both
                    </button>
                  )}
                </div>
                {finalNoteYText ?
                  <NoteEditor
                    yText={finalNoteYText}
                    inline={true}
                    placeholder='Add the final reconciled note...'
                    maxLength={MAX_LENGTH}
                    focusRingColor='green-500'
                  />
                : <p className='text-muted-foreground/70 text-xs italic'>Loading...</p>}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
