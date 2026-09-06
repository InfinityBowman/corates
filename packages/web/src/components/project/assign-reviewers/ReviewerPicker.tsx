/**
 * ReviewerPicker - One reviewer slot: a chip that opens the member list.
 * The other slot's holder is listed but disabled.
 */

import { useRef, useState } from 'react';
import { CheckIcon, SearchIcon, UserRoundPlusIcon, XIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { MemberEntry } from '@/stores/projectStore';
import { MemberAvatar, memberDisplayName } from '../MemberAvatar';

// Search only appears once the list is long enough to need it.
const SEARCH_THRESHOLD = 6;

interface ReviewerPickerProps {
  slotLabel: string;
  studyName: string;
  value: string | null;
  onChange: (userId: string | null) => void;
  members: MemberEntry[];
  takenBy: string | null;
  takenLabel: string;
  currentUserId: string | null;
  load: Record<string, number>;
}

const optionClass =
  'hover:bg-muted focus-visible:bg-muted flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left text-sm outline-none disabled:pointer-events-none disabled:opacity-50';

export function ReviewerPicker({
  slotLabel,
  studyName,
  value,
  onChange,
  members,
  takenBy,
  takenLabel,
  currentUserId,
  load,
}: ReviewerPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = members.find(m => m.userId === value) ?? null;
  const showSearch = members.length > SEARCH_THRESHOLD;
  const needle = query.trim().toLowerCase();
  const visible =
    needle ?
      members.filter(m =>
        `${m.name} ${m.email} ${m.givenName} ${m.familyName}`.toLowerCase().includes(needle),
      )
    : members;

  const enabledOptions = () =>
    Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? [],
    );

  const focusFirstOption = () => {
    const options = enabledOptions();
    (options.find(o => o.getAttribute('aria-selected') === 'true') ?? options[0])?.focus();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  const choose = (userId: string | null) => {
    onChange(userId);
    handleOpenChange(false);
  };

  const handleListKeyDown = (event: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const options = enabledOptions();
    if (options.length === 0) return;
    event.preventDefault();
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    let next = 0;
    if (event.key === 'ArrowDown') next = (current + 1) % options.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + options.length) % options.length;
    else if (event.key === 'End') next = options.length - 1;
    options[next].focus();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type='button'
          role='combobox'
          aria-haspopup='listbox'
          aria-expanded={open}
          aria-label={`${slotLabel} for ${studyName}`}
          className={cn(
            'focus-visible:border-ring focus-visible:ring-ring/50 flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 text-xs transition-colors outline-none focus-visible:ring-3',
            selected ?
              'border-border bg-card text-foreground hover:bg-muted aria-expanded:bg-muted'
            : 'border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground aria-expanded:border-muted-foreground aria-expanded:text-foreground border-dashed',
          )}
        >
          {selected ?
            <>
              <MemberAvatar member={selected} className='text-3xs size-4.5' />
              <span className='truncate'>{memberDisplayName(selected)}</span>
            </>
          : <>
              <UserRoundPlusIcon className='size-3.5 shrink-0' />
              <span className='truncate'>{slotLabel}</span>
            </>
          }
        </button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-60 gap-0 p-1'
        onOpenAutoFocus={event => {
          event.preventDefault();
          if (showSearch) searchRef.current?.focus();
          else focusFirstOption();
        }}
      >
        {showSearch && (
          <div className='border-border mb-1 flex items-center gap-1.5 border-b px-1.5 pb-1.5'>
            <SearchIcon className='text-muted-foreground size-3.5 shrink-0' />
            <input
              ref={searchRef}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  focusFirstOption();
                }
              }}
              placeholder='Find a member'
              aria-label='Find a member'
              className='placeholder:text-muted-foreground h-6 min-w-0 flex-1 bg-transparent text-sm outline-none'
            />
          </div>
        )}

        <div
          ref={listRef}
          role='listbox'
          aria-label={slotLabel}
          onKeyDown={handleListKeyDown}
          className='flex max-h-64 flex-col overflow-y-auto'
        >
          {visible.map(member => {
            const taken = member.userId === takenBy;
            const isSelected = member.userId === value;
            const count = load[member.userId] ?? 0;
            return (
              <button
                key={member.userId}
                type='button'
                role='option'
                aria-selected={isSelected}
                disabled={taken}
                onClick={() => choose(member.userId)}
                className={optionClass}
              >
                <MemberAvatar member={member} className='text-3xs size-5' />
                <span className='min-w-0 flex-1 truncate'>
                  {memberDisplayName(member)}
                  {member.userId === currentUserId && (
                    <span className='text-muted-foreground'> (you)</span>
                  )}
                </span>
                {taken ?
                  <span className='text-2xs text-muted-foreground shrink-0'>{takenLabel}</span>
                : isSelected ?
                  <CheckIcon className='text-primary size-3.5 shrink-0' />
                : <span className='text-2xs text-muted-foreground shrink-0 tabular-nums'>
                    {count} {count === 1 ? 'study' : 'studies'}
                  </span>
                }
              </button>
            );
          })}

          {visible.length === 0 && (
            <p className='text-muted-foreground px-1.5 py-2 text-xs'>No member matches that.</p>
          )}

          {selected && (
            <>
              <div className='border-border my-1 border-t' />
              <button
                type='button'
                role='option'
                aria-selected={false}
                onClick={() => choose(null)}
                className={cn(optionClass, 'text-muted-foreground')}
              >
                <XIcon className='size-3.5 shrink-0' />
                Remove reviewer
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
