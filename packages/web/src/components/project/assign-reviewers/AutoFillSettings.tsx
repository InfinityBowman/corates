/**
 * AutoFillSettings - Per-member share of the studies Auto-fill hands out.
 */

import { useId } from 'react';
import { SlidersHorizontalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { MemberEntry } from '@/stores/projectStore';
import { MemberAvatar, memberDisplayName } from '../MemberAvatar';

interface AutoFillSettingsProps {
  members: MemberEntry[];
  currentUserId: string | null;
  shares: Record<string, number>;
  onChange: (shares: Record<string, number>) => void;
  disabled?: boolean;
}

const PRESETS = [0, 25, 33, 50, 66, 75, 100];

/** Whole percentages totalling exactly 100. */
export function evenShares(memberIds: string[]): Record<string, number> {
  const base = Math.floor(100 / memberIds.length);
  const remainder = 100 - base * memberIds.length;
  return Object.fromEntries(memberIds.map((id, i) => [id, i < remainder ? base + 1 : base]));
}

export function AutoFillSettings({
  members,
  currentUserId,
  shares,
  onChange,
  disabled,
}: AutoFillSettingsProps) {
  const id = useId();
  const total = members.reduce((sum, m) => sum + (shares[m.userId] ?? 0), 0);
  const isEven = members.every(
    m => shares[m.userId] === evenShares(members.map(x => x.userId))[m.userId],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='icon-sm'
          disabled={disabled}
          aria-label='Auto-fill shares'
          className='rounded-l-none'
        >
          <SlidersHorizontalIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-120 max-w-[calc(100vw-2rem)] gap-0 p-0'>
        <div className='px-3 pt-3 pb-2'>
          <p className='text-sm font-medium'>Share of studies</p>
          <p className='text-muted-foreground mt-0.5 text-xs'>
            Auto-fill gives each study to whoever is furthest below their share. Shares are
            relative, so they do not have to total 100. Set someone to 0 to leave them out.
          </p>
        </div>
        <div className='border-border flex flex-col gap-1.5 border-t px-3 py-2.5'>
          {members.map(member => {
            const inputId = `${id}-${member.userId}`;
            const share = shares[member.userId] ?? 0;
            const setShare = (value: number) =>
              onChange({ ...shares, [member.userId]: Math.max(0, Math.min(100, value)) });
            return (
              <div key={member.userId} className='flex items-center gap-2'>
                <MemberAvatar member={member} className='text-3xs size-5' />
                <label htmlFor={inputId} className='min-w-0 flex-1 truncate text-sm'>
                  {memberDisplayName(member)}
                  {member.userId === currentUserId && (
                    <span className='text-muted-foreground'> (you)</span>
                  )}
                </label>
                <div className='flex shrink-0 gap-0.5' role='group' aria-label='Share presets'>
                  {PRESETS.map(preset => (
                    <button
                      key={preset}
                      type='button'
                      aria-pressed={share === preset}
                      onClick={() => setShare(preset)}
                      className={cn(
                        'text-2xs h-6 rounded-md px-1.5 font-medium tabular-nums transition-colors',
                        share === preset ?
                          'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-muted',
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className='relative shrink-0'>
                  <input
                    id={inputId}
                    type='number'
                    min={0}
                    max={100}
                    value={share}
                    onChange={event => setShare(Number(event.target.value) || 0)}
                    aria-label={`Custom share for ${memberDisplayName(member)}`}
                    className='border-input focus-visible:border-ring focus-visible:ring-ring/50 h-7 w-16 rounded-md border bg-transparent pr-5 text-right text-xs tabular-nums outline-none focus-visible:ring-3'
                  />
                  <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs'>
                    %
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className='border-border bg-muted/50 flex items-center gap-2 border-t px-3 py-2'>
          <p className='text-muted-foreground min-w-0 flex-1 truncate text-xs tabular-nums'>
            Totals {total}%
          </p>
          <Button
            variant='ghost'
            size='xs'
            disabled={isEven}
            onClick={() => onChange(evenShares(members.map(m => m.userId)))}
          >
            Even split
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
