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

/**
 * Renders as an AdminPanel footer. It stays mounted on a single page of results
 * so the panel keeps its height when a filter narrows the list to one page.
 */
export function ServerPagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  label = 'results',
}: ServerPaginationProps) {
  const pages = Math.max(1, totalPages);

  return (
    <>
      <p className='text-muted-foreground text-[13px] tabular-nums'>
        {total > 0 ?
          `${(page - 1) * limit + 1}-${Math.min(page * limit, total)} of ${total} ${label}`
        : `No ${label}`}
      </p>
      <div className='flex items-center gap-1'>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label='Previous page'
        >
          <ChevronLeftIcon className='size-4' />
        </Button>
        <span className='text-muted-foreground px-1 text-[13px] tabular-nums'>
          Page {page} of {pages}
        </span>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          disabled={page >= pages}
          aria-label='Next page'
        >
          <ChevronRightIcon className='size-4' />
        </Button>
      </div>
    </>
  );
}
