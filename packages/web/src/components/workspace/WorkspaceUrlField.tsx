/** The workspace URL input: the site prefix, the slug, and its availability. */

import { CheckIcon, LoaderIcon, TriangleAlertIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { WORKSPACE_SLUG_MAX } from '@corates/shared';
import type { SlugStatus } from '@/hooks/useSlugAvailability';
import { cn } from '@/lib/utils';

const HOST = typeof window === 'undefined' ? 'corates.org' : window.location.host;

interface WorkspaceUrlFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  status: SlugStatus;
  disabled?: boolean;
}

export function WorkspaceUrlField({
  id,
  value,
  onChange,
  status,
  disabled,
}: WorkspaceUrlFieldProps) {
  // An empty field is unfinished, not wrong; the submit button stays disabled.
  const problem = value !== '' && (status.state === 'invalid' || status.state === 'taken');
  return (
    <div className='flex flex-col gap-1.5'>
      <div
        className={cn(
          'border-input focus-within:ring-ring/50 flex h-9 items-center overflow-hidden rounded-md border shadow-xs focus-within:ring-[3px]',
          problem && 'border-destructive',
        )}
      >
        <span className='text-muted-foreground bg-muted/50 border-input flex h-full items-center border-r px-3 text-sm select-none'>
          {HOST}/
        </span>
        <Input
          id={id}
          value={value}
          onChange={e => onChange(e.target.value.toLowerCase())}
          maxLength={WORKSPACE_SLUG_MAX}
          disabled={disabled}
          autoComplete='off'
          spellCheck={false}
          aria-invalid={problem}
          aria-describedby={`${id}-status`}
          className='h-full rounded-none border-0 shadow-none focus-visible:ring-0'
        />
      </div>
      <p id={`${id}-status`} className='flex min-h-4 items-center gap-1 text-xs' aria-live='polite'>
        {status.state === 'checking' && (
          <>
            <LoaderIcon className='text-muted-foreground size-3 animate-spin' />
            <span className='text-muted-foreground'>Checking...</span>
          </>
        )}
        {status.state === 'available' && (
          <>
            <CheckIcon className='text-success size-3' />
            <span className='text-success'>Available</span>
          </>
        )}
        {problem && (
          <>
            <TriangleAlertIcon className='text-destructive size-3' />
            <span className='text-destructive'>{status.message}</span>
          </>
        )}
      </p>
    </div>
  );
}
