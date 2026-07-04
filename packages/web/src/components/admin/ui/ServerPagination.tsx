import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ServerPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function ServerPagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  label = 'results',
}: ServerPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className='flex items-center justify-between'>
      <p className='text-muted-foreground text-sm'>
        {total > 0 ?
          `Showing ${(page - 1) * limit + 1} to ${Math.min(page * limit, total)} of ${total} ${label}`
        : `No ${label} found`}
      </p>
      <div className='flex items-center gap-2'>
        <Button
          type='button'
          variant='outline'
          size='icon'
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          <ChevronLeftIcon />
        </Button>
        <span className='text-muted-foreground text-sm'>
          Page {page} of {totalPages}
        </span>
        <Button
          type='button'
          variant='outline'
          size='icon'
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
