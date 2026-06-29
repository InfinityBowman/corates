/**
 * InlineEdit - click-to-edit text, single-line or multiline.
 *
 * Controlled by `value`; commits the edited draft via `onCommit` on Enter or
 * blur, and reverts on Escape. For multiline, Shift+Enter inserts a newline.
 *
 * @example
 * <InlineEdit value={name} onCommit={handleRename} showEditIcon />
 *
 * @example
 * <InlineEdit value={desc} onCommit={handleSave} multiline placeholder='Add a description...' />
 */

import * as React from 'react';
import { PencilIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditProps {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  showEditIcon?: boolean;
  /** Styles applied to both the preview text and the editing field. */
  className?: string;
  ariaLabel?: string;
}

function InlineEdit({
  value,
  onCommit,
  placeholder = 'Click to edit...',
  multiline = false,
  rows = 1,
  disabled = false,
  showEditIcon = false,
  className,
  ariaLabel,
}: InlineEditProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const fieldRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const startEditing = () => {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  };

  React.useLayoutEffect(() => {
    if (editing && fieldRef.current) {
      fieldRef.current.focus();
      fieldRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && (!multiline || !e.shiftKey)) {
      e.preventDefault();
      commit();
    }
  };

  if (editing) {
    const fieldClass = cn('w-full bg-transparent outline-none', className);
    return multiline ?
        <textarea
          ref={el => {
            fieldRef.current = el;
          }}
          rows={rows}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={cn('resize-none', fieldClass)}
        />
      : <input
          ref={el => {
            fieldRef.current = el;
          }}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={fieldClass}
        />;
  }

  return (
    <span
      className={cn(
        'group gap-1',
        multiline ? 'flex w-full items-start' : 'inline-flex items-center',
      )}
    >
      <button
        type='button'
        onClick={startEditing}
        disabled={disabled}
        className={cn(
          'cursor-text text-left',
          multiline && 'w-full',
          !value && 'text-muted-foreground/70',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        {value || placeholder}
      </button>
      {showEditIcon && !disabled && (
        <button
          type='button'
          onClick={startEditing}
          aria-label={ariaLabel ?? 'Edit'}
          className='text-muted-foreground/60 hover:text-muted-foreground rounded p-1 opacity-0 transition-colors group-hover:opacity-100'
        >
          <PencilIcon className='size-3.5' />
        </button>
      )}
    </span>
  );
}

export { InlineEdit };
