/** Search box used in admin panel headers and toolbars. */

import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AdminSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

export function AdminSearch({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  'aria-label': ariaLabel,
}: AdminSearchProps) {
  return (
    <div className={cn('relative', className)}>
      <SearchIcon className='text-muted-foreground/70 pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
      <Input
        type='text'
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className='h-8 pr-8 pl-8 text-[13px]'
      />
      {value && (
        <Button
          type='button'
          variant='ghost'
          size='icon-xs'
          onClick={() => onChange('')}
          aria-label='Clear search'
          className='text-muted-foreground/70 hover:text-foreground absolute top-1/2 right-1 -translate-y-1/2'
        >
          <XIcon className='size-3.5' />
        </Button>
      )}
    </div>
  );
}
