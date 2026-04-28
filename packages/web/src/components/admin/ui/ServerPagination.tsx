import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

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
        <button
          type='button'
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className='border-border bg-card hover:bg-muted rounded-lg border p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
        >
          <ChevronLeftIcon className='size-4' />
        </button>
        <span className='text-muted-foreground text-sm'>
          Page {page} of {totalPages}
        </span>
        <button
          type='button'
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className='border-border bg-card hover:bg-muted rounded-lg border p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
        >
          <ChevronRightIcon className='size-4' />
        </button>
      </div>
    </div>
  );
}
