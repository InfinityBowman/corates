/**
 * AdminDataTable - TanStack React Table wrapper with consistent styling
 *
 * Full-featured data table with sorting, pagination, loading skeletons, empty states,
 * and row click handling.
 */

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronUpIcon, ChevronDownIcon } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface AdminDataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  loading?: boolean;
  emptyState?: React.ReactNode;
  emptyMessage?: string;
  enableSorting?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  onRowClick?: (_row: T) => void;
  className?: string;
}

export function AdminDataTable<T>({
  columns,
  data,
  loading,
  emptyState,
  emptyMessage,
  enableSorting = false,
  enablePagination,
  pageSize = 10,
  onRowClick,
  className = '',
}: AdminDataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: data || [],
    columns: columns || [],
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
    enableSorting,
  });

  const skeletonRows = useMemo(() => Array(pageSize || 5).fill(0), [pageSize]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className='border-border rounded-xl border'>
        <Table className='min-w-max'>
          <TableHeader className='border-border bg-muted'>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className={`text-muted-foreground px-4 py-2 text-xs tracking-wider uppercase ${
                      header.column.getCanSort() && enableSorting ?
                        'hover:bg-secondary cursor-pointer select-none'
                      : ''
                    }`}
                    onClick={enableSorting ? header.column.getToggleSortingHandler() : undefined}
                    style={{
                      width:
                        header.column.columnDef.size ? `${header.column.columnDef.size}px` : 'auto',
                    }}
                  >
                    <div className='flex items-center gap-1'>
                      {header.isPlaceholder ? null : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                      {enableSorting && header.column.getCanSort() && (
                        <span className='text-muted-foreground/70 ml-1'>
                          {header.column.getIsSorted() === 'asc' ?
                            <ChevronUpIcon className='size-4' />
                          : header.column.getIsSorted() === 'desc' ?
                            <ChevronDownIcon className='size-4' />
                          : <span className='size-4' />}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className='divide-border bg-card divide-y'>
            {/* Loading State */}
            {loading &&
              skeletonRows.map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((_, j) => (
                    <TableCell key={`skeleton-cell-${j}`} className='px-4 py-2'>
                      <Skeleton className='h-4 w-3/4' />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {/* Empty State */}
            {!loading && table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length || 1} className='px-4 py-8 text-center'>
                  {emptyState || (
                    <div className='flex flex-col items-center gap-2'>
                      <span className='text-muted-foreground/70'>
                        {emptyMessage || 'No data available'}
                      </span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}

            {/* Data Rows */}
            {!loading &&
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className='text-foreground px-4 py-2 text-sm'>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {enablePagination && table.getPageCount() > 1 && (
        <div className='flex items-center justify-between px-2'>
          <span className='text-muted-foreground text-sm'>
            Showing{' '}
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              data?.length || 0,
            )}{' '}
            of {data?.length || 0} results
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Previous
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
