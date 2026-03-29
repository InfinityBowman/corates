/**
 * NoteEditor - Y.Text-bound textarea for editing notes
 *
 * Binds directly to a Y.Text instance (or LocalTextAdapter) for real-time
 * collaborative editing. Changes sync automatically via Yjs.
 * Supports two modes: collapsible (AMSTAR2 per-question notes) and inline (ROB2/ROBINS-I comments).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRightIcon, BookOpenIcon } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useYText } from '@/hooks/useYText';

const MAX_HEIGHT = 300;

interface NoteEditorProps {
  yText: any;
  placeholder?: string;
  readOnly?: boolean;
  collapsed?: boolean;
  maxLength?: number;
  label?: string;
  inline?: boolean;
  focusRingColor?: string;
}

export function NoteEditor({
  yText,
  placeholder,
  readOnly = false,
  collapsed = true,
  maxLength = 2000,
  label,
  inline = false,
  focusRingColor,
}: NoteEditorProps) {
  const initialExpanded = readOnly ? true : !collapsed;
  const [expanded, setExpanded] = useState(initialExpanded);
  const localValue = useYText(yText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea when value or expanded state changes
  useEffect(() => {
    const isVisible = inline ? true : expanded;
    if (textareaRef.current && isVisible) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, MAX_HEIGHT)}px`;
    }
  }, [localValue, expanded, inline]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;

      if (newValue.length > maxLength) {
        e.target.value = newValue.slice(0, maxLength);
        return;
      }

      // Immediate resize
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, MAX_HEIGHT)}px`;

      if (!yText || readOnly) return;

      // Update Y.Text in a transaction to avoid intermediate empty states
      yText.doc.transact(() => {
        yText.delete(0, yText.length);
        yText.insert(0, newValue);
      });
    },
    [yText, readOnly, maxLength],
  );

  const hasContent = localValue.trim().length > 0;
  const charCount = localValue.length;

  const focusRingClass =
    focusRingColor === 'green-500' ? 'focus:ring-green-500' : 'focus:ring-blue-500';

  const textareaContent = (
    <>
      <textarea
        ref={textareaRef}
        value={localValue}
        onChange={handleInput}
        placeholder={placeholder || 'Add a note for this question...'}
        disabled={readOnly || !yText}
        className={`w-full resize-none overflow-hidden rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:outline-none ${focusRingClass} ${readOnly ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-card text-foreground'} ${!yText ? 'bg-secondary cursor-not-allowed' : ''}`}
        style={{ minHeight: '60px' }}
        maxLength={maxLength}
      />
      <div className='text-2xs text-muted-foreground/70 mt-1 flex items-center justify-between'>
        <span>{readOnly ? 'Read-only' : ''}</span>
        <span className={charCount > maxLength * 0.9 ? 'text-warning' : ''}>
          {charCount} / {maxLength}
        </span>
      </div>
    </>
  );

  if (inline) {
    return <div>{textareaContent}</div>;
  }

  return (
    <div className='border-border/50 mt-3 border-t pt-2'>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger
          className={`flex cursor-pointer items-center gap-1.5 py-1 text-xs select-none ${hasContent ? 'text-blue-600 hover:text-blue-700' : 'text-muted-foreground hover:text-secondary-foreground'}`}
        >
          <ChevronRightIcon
            className={`size-4 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
          <BookOpenIcon className='size-3 shrink-0' />
          <span className='font-medium'>{label || 'Notes'}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className='px-0.5 pt-2 pb-0.5'>{textareaContent}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/**
 * Read-only note display for reconciliation view
 */
export function NoteDisplay({ content }: { content?: string }) {
  const hasContent = (content || '').trim().length > 0;

  if (!hasContent) return null;

  return (
    <div className='border-border/50 bg-muted mt-2 rounded-lg border p-2'>
      <div className='text-muted-foreground mb-1 flex items-center gap-1.5 text-xs'>
        <BookOpenIcon className='size-3' />
        <span>Notes</span>
      </div>
      <p className='text-secondary-foreground text-sm whitespace-pre-wrap'>{content}</p>
    </div>
  );
}
