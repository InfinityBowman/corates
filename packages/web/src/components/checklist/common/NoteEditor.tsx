/**
 * NoteEditor - controlled textarea for editing notes
 *
 * Reads a plain string value and reports edits via onChange; the caller wires
 * it to the sync engine (answer rows). Keeps a local draft while focused so
 * remote updates don't clobber in-progress typing.
 * Supports two modes: collapsible (AMSTAR2 per-question notes) and inline (ROB2/ROBINS-I comments).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRightIcon, BookOpenIcon } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

const MAX_HEIGHT = 300;

interface NoteEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  maxLength?: number;
  label?: string;
  inline?: boolean;
  focusRingColor?: string;
  /**
   * Live mode: the value is a collaborative text binding (a Yjs field) that
   * must be followed even while focused — remote co-edits merge into the
   * textarea instead of being held off by the local draft. Row-backed
   * callers keep the default draft-hold so LWW echoes don't clobber typing.
   */
  live?: boolean;
}

export function NoteEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  disabled = false,
  collapsed = true,
  maxLength = 2000,
  label,
  inline = false,
  focusRingColor,
  live = false,
}: NoteEditorProps) {
  const initialExpanded = readOnly ? true : !collapsed;
  const [expanded, setExpanded] = useState(initialExpanded);
  const [localValue, setLocalValue] = useState(value);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Follow remote/prop updates when not actively editing (always, in live mode)
  useEffect(() => {
    if (live || !focused) {
      setLocalValue(value);
    }
  }, [value, focused, live]);

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

      // Immediate resize
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, MAX_HEIGHT)}px`;

      setLocalValue(newValue);

      if (readOnly || disabled) return;

      onChange(newValue);
    },
    [onChange, readOnly, disabled],
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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder || 'Add a note for this question...'}
        disabled={readOnly || disabled}
        className={`w-full resize-none overflow-hidden rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:outline-none ${focusRingClass} ${readOnly ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-card text-foreground'} ${disabled ? 'bg-secondary cursor-not-allowed' : ''}`}
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
