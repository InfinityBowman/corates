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
      <div className='border-border overflow-x-auto rounded-xl border'>
        <table className='w-full min-w-max'>
          <thead className='border-border bg-muted border-b'>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className={`text-muted-foreground px-4 py-2 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase ${
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
                            <ChevronUpIcon className='h-4 w-4' />
                          : header.column.getIsSorted() === 'desc' ?
                            <ChevronDownIcon className='h-4 w-4' />
                          : <span className='h-4 w-4' />}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className='divide-border bg-card divide-y'>
            {/* Loading State */}
            {loading &&
              skeletonRows.map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((_, j) => (
                    <td key={`skeleton-cell-${j}`} className='px-4 py-2'>
                      <div className='bg-secondary h-4 w-3/4 animate-pulse rounded' />
                    </td>
                  ))}
                </tr>
              ))}

            {/* Empty State */}
            {!loading && table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length || 1} className='px-4 py-8 text-center'>
                  {emptyState || (
                    <div className='flex flex-col items-center gap-2'>
                      <span className='text-muted-foreground/70'>
                        {emptyMessage || 'No data available'}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            )}

            {/* Data Rows */}
            {!loading &&
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className={`hover:bg-muted transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className='text-foreground px-4 py-2 text-sm whitespace-nowrap'
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
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
            <button
              type='button'
              className='border-border bg-card text-secondary-foreground hover:bg-muted rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Previous
            </button>
            <button
              type='button'
              className='border-border bg-card text-secondary-foreground hover:bg-muted rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
