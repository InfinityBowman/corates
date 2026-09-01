/**
 * EmailChipInput - Multi-email chip field for setup team invites.
 */

import { useRef, useState, type KeyboardEvent } from 'react';
import { XIcon } from 'lucide-react';
import { isValidEmail, normalizeEmail } from '@corates/shared/email';
import { getInitials } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface EmailChip {
  email: string;
  isExistingUser?: boolean;
  displayName?: string | null;
}

interface EmailChipInputProps {
  chips: EmailChip[];
  onChange: (chips: EmailChip[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function chipInitials(chip: EmailChip): string {
  if (chip.displayName) return getInitials(chip.displayName);
  const local = chip.email.split('@')[0] ?? '';
  const segments = local.split(/[._-]+/).filter(Boolean);
  if (segments.length >= 2) {
    return `${segments[0][0] ?? ''}${segments[1][0] ?? ''}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || '??';
}

export function EmailChipInput({
  chips,
  onChange,
  disabled = false,
  placeholder = 'Type an email and press Enter',
  className,
}: EmailChipInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addEmail = (raw: string) => {
    const email = normalizeEmail(raw);
    if (!isValidEmail(email)) return;
    if (chips.some(chip => chip.email === email)) return;
    onChange([...chips, { email }]);
    setInputValue('');
  };

  const removeEmail = (email: string) => {
    onChange(chips.filter(chip => chip.email !== email));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (inputValue.trim()) addEmail(inputValue);
      return;
    }
    if (event.key === 'Backspace' && !inputValue && chips.length > 0) {
      removeEmail(chips[chips.length - 1].email);
    }
  };

  return (
    <div
      className={cn(
        'border-input bg-background focus-within:border-primary focus-within:ring-primary/10 flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border px-3 py-2 focus-within:ring-3',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {chips.map(chip => (
        <span
          key={chip.email}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1.5 text-xs font-semibold',
            chip.isExistingUser ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'flex size-5 items-center justify-center rounded-full text-[9.5px] font-bold',
              chip.isExistingUser ?
                'bg-primary/20 text-primary'
              : 'bg-border text-muted-foreground',
            )}
          >
            {chipInitials(chip)}
          </span>
          {chip.email}
          {!disabled && (
            <button
              type='button'
              onClick={event => {
                event.stopPropagation();
                removeEmail(chip.email);
              }}
              className='hover:text-foreground text-muted-foreground/70'
              aria-label={`Remove ${chip.email}`}
            >
              <XIcon className='size-3' />
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        type='email'
        value={inputValue}
        disabled={disabled}
        onChange={event => setInputValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) addEmail(inputValue);
        }}
        placeholder={chips.length === 0 ? placeholder : ''}
        className='placeholder:text-muted-foreground min-w-40 flex-1 bg-transparent text-sm outline-none'
        autoComplete='off'
      />
    </div>
  );
}
