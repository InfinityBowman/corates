import { useState } from 'react';
import {
  useTable,
  tableFeatures,
  rowSortingFeature,
  createSortedRowModel,
  sortFn_alphanumeric,
  sortFn_text,
  flexRender,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronUpIcon, ChevronDownIcon, ChevronsUpDownIcon } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// V9 resolves the default 'auto' sort only against registered functions;
// these two are what V8 picked for our string columns.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});

export type AdminColumnDef<T extends RowData> = ColumnDef<typeof features, T, unknown>;

/** Set on a column's `meta`. */
export interface AdminColumnMeta {
  /** Applied to the header and body cell alike, so widths stay in step. */
  className?: string;
  align?: 'left' | 'right';
}

interface AdminDataTableProps<T extends RowData> {
  columns: AdminColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyState?: React.ReactNode;
  enableSorting?: boolean;
  onRowClick?: (_row: T) => void;
  /**
   * Skeleton rows drawn while loading. Set to the page size so a full page of
   * results lands at the same height the placeholder occupied.
   */
  skeletonRows?: number;
  /** Dims the rows in place while a new page or search result is in flight. */
  refreshing?: boolean;
  /** Pads the body out to this many rows so the panel keeps one height. */
  fillRows?: number;
  /** 'page' fills the shell and scrolls under a pinned header; 'panel' sits in a card. */
  variant?: 'panel' | 'page';
}

export function AdminDataTable<T extends RowData>({
  columns,
  data,
  loading,
  emptyState = 'No data available',
  enableSorting = false,
  onRowClick,
  skeletonRows = 8,
  refreshing,
  fillRows,
  variant = 'panel',
}: AdminDataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useTable({
    features,
    data: data || [],
    columns: columns || [],
    state: { sorting },
    onSortingChange: setSorting,
    enableSorting,
  });

  const rows = table.getRowModel().rows;

  const fillerCount = fillRows ? Math.max(0, fillRows - rows.length) : 0;
  const isPage = variant === 'page';
  // Rows span the full width, so the edge cells carry the header bar's inset.
  const edgeInset =
    isPage ?
      '[&_td:first-child]:pl-6 [&_th:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:last-child]:pr-6'
    : '';

  return (
    <Table className={edgeInset} containerClassName={cn(isPage && 'min-h-0 flex-1')}>
      <TableHeader className={cn('bg-muted/40', isPage && 'bg-background sticky top-0 z-10')}>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow key={headerGroup.id} className='border-border hover:bg-transparent'>
            {headerGroup.headers.map(header => {
              const sortable = enableSorting && header.column.getCanSort();
              const sorted = header.column.getIsSorted();
              const meta = header.column.columnDef.meta as AdminColumnMeta | undefined;
              return (
                <TableHead
                  key={header.id}
                  aria-sort={
                    sorted === 'asc' ? 'ascending'
                    : sorted === 'desc' ?
                      'descending'
                    : undefined
                  }
                  className={cn(
                    'text-muted-foreground h-9 px-3 text-xs font-medium',
                    isPage && 'bg-muted/40',
                    sortable &&
                      'hover:text-foreground cursor-pointer transition-colors select-none',
                    meta?.className,
                  )}
                  onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                >
                  <div
                    className={cn(
                      'flex items-center gap-1',
                      meta?.align === 'right' && 'justify-end',
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                    {sortable && (
                      <span className='inline-flex size-3.5 items-center justify-center'>
                        {sorted === 'asc' ?
                          <ChevronUpIcon className='size-3.5' />
                        : sorted === 'desc' ?
                          <ChevronDownIcon className='size-3.5' />
                        : <ChevronsUpDownIcon className='size-3.5 opacity-30' />}
                      </span>
                    )}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody
        className={cn('transition-opacity duration-150', refreshing && 'opacity-60')}
        aria-busy={refreshing || loading}
      >
        {loading &&
          Array.from({ length: skeletonRows }, (_, i) => (
            <TableRow key={`skeleton-${i}`} className='border-border hover:bg-transparent'>
              {columns.map((_, j) => (
                <TableCell
                  key={`skeleton-cell-${j}`}
                  className={cn('px-3', isPage ? 'h-10' : 'h-11')}
                >
                  <Skeleton className='h-3.5' style={{ width: `${45 + ((j * 17) % 40)}%` }} />
                </TableCell>
              ))}
            </TableRow>
          ))}

        {!loading && rows.length === 0 && (
          <TableRow className='hover:bg-transparent'>
            <TableCell
              colSpan={columns.length || 1}
              className='text-muted-foreground px-3 text-center whitespace-normal'
              style={
                isPage ? { height: '40vh' }
                : fillRows ?
                  { height: fillRows * 44 }
                : { height: 160 }
              }
            >
              {emptyState}
            </TableCell>
          </TableRow>
        )}

        {!loading &&
          rows.map(row => (
            <TableRow
              key={row.id}
              className={cn('border-border', onRowClick && 'cursor-pointer')}
              onClick={() => onRowClick?.(row.original)}
            >
              {row.getAllCells().map(cell => {
                const meta = cell.column.columnDef.meta as AdminColumnMeta | undefined;
                return (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      'text-foreground px-3 text-[13px]',
                      isPage ? 'h-10' : 'h-11',
                      meta?.align === 'right' && 'text-right',
                      meta?.className,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}

        {/* Holds the panel at one page's height, so narrowing a search or
            landing on a short last page never resizes it. */}
        {!loading &&
          rows.length > 0 &&
          Array.from({ length: fillerCount }, (_, i) => (
            <TableRow key={`filler-${i}`} className='border-border hover:bg-transparent'>
              <TableCell
                colSpan={columns.length || 1}
                className={cn('px-3', isPage ? 'h-10' : 'h-11')}
              />
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
