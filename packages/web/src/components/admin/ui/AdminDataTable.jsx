/**
 * AdminDataTable - TanStack Table wrapper with consistent styling
 *
 * Full-featured data table component using @tanstack/solid-table with:
 * - Column sorting
 * - Pagination
 * - Loading skeletons
 * - Empty states
 * - Row click handling
 *
 * Based on Polar's DataTable pattern.
 *
 * @example
 * const columns = [
 *   { accessorKey: 'name', header: 'Name' },
 *   { accessorKey: 'email', header: 'Email' },
 *   {
 *     accessorKey: 'status',
 *     header: 'Status',
 *     cell: info => <StatusBadge status={info.getValue()} />
 *   },
 * ];
 *
 * <AdminDataTable
 *   columns={columns}
 *   data={users()}
 *   loading={isLoading()}
 *   enableSorting
 *   enablePagination
 *   onRowClick={row => navigate(`/admin/users/${row.id}`)}
 * />
 */

import {
  createSolidTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/solid-table';
import { createSignal, For, Show } from 'solid-js';
import { FiChevronUp, FiChevronDown } from 'solid-icons/fi';

/**
 * @param {Object} props
 * @param {import('@tanstack/solid-table').ColumnDef[]} props.columns - TanStack column definitions
 * @param {Array} props.data - Table data array
 * @param {boolean} [props.loading] - Show loading skeletons
 * @param {JSX.Element} [props.emptyState] - Custom empty state component
 * @param {string} [props.emptyMessage] - Simple empty state message
 * @param {boolean} [props.enableSorting] - Enable column sorting
 * @param {boolean} [props.enablePagination] - Enable pagination controls
 * @param {number} [props.pageSize=10] - Items per page
 * @param {Function} [props.onRowClick] - Row click handler, receives row data
 * @param {string} [props.class] - Additional CSS classes for container
 */
export function AdminDataTable(props) {
  const [sorting, setSorting] = createSignal([]);

  const table = createSolidTable({
    get data() {
      return props.data || [];
    },
    get columns() {
      return props.columns || [];
    },
    state: {
      get sorting() {
        return sorting();
      },
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      // eslint-disable-next-line solid/reactivity
      pagination: { pageSize: props.pageSize || 10 },
    },
    // eslint-disable-next-line solid/reactivity
    enableSorting: props.enableSorting ?? false,
  });

  const skeletonRows = () => Array(props.pageSize || 5).fill(0);

  return (
    <div class={`flex flex-col gap-4 ${props.class || ''}`}>
      <div class='border-border overflow-x-auto rounded-xl border'>
        <table class='w-full min-w-max'>
          <thead class='border-border bg-muted border-b'>
            <For each={table.getHeaderGroups()}>
              {headerGroup => (
                <tr>
                  <For each={headerGroup.headers}>
                    {header => (
                      <th
                        class='text-muted-foreground px-4 py-2 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase'
                        classList={{
                          'cursor-pointer select-none hover:bg-secondary':
                            header.column.getCanSort() && props.enableSorting,
                        }}
                        onClick={
                          props.enableSorting ? header.column.getToggleSortingHandler() : undefined
                        }
                        style={{
                          width:
                            header.column.columnDef.size ?
                              `${header.column.columnDef.size}px`
                            : 'auto',
                        }}
                      >
                        <div class='flex items-center gap-1'>
                          {header.isPlaceholder ? null : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                          <Show when={props.enableSorting && header.column.getCanSort()}>
                            <span class='text-muted-foreground/70 ml-1'>
                              {header.column.getIsSorted() === 'asc' ?
                                <FiChevronUp class='h-4 w-4' />
                              : header.column.getIsSorted() === 'desc' ?
                                <FiChevronDown class='h-4 w-4' />
                              : <span class='h-4 w-4' />}
                            </span>
                          </Show>
                        </div>
                      </th>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </thead>
          <tbody class='divide-border bg-card divide-y'>
            {/* Loading State */}
            <Show when={props.loading}>
              <For each={skeletonRows()}>
                {() => (
                  <tr>
                    <For each={props.columns}>
                      {() => (
                        <td class='px-4 py-2'>
                          <div class='bg-secondary h-4 w-3/4 animate-pulse rounded' />
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </Show>

            {/* Empty State */}
            <Show when={!props.loading && table.getRowModel().rows.length === 0}>
              <tr>
                <td colspan={props.columns?.length || 1} class='px-4 py-8 text-center'>
                  {props.emptyState || (
                    <div class='flex flex-col items-center gap-2'>
                      <span class='text-muted-foreground/70'>
                        {props.emptyMessage || 'No data available'}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            </Show>

            {/* Data Rows */}
            <Show when={!props.loading && table.getRowModel().rows.length > 0}>
              <For each={table.getRowModel().rows}>
                {row => (
                  <tr
                    class='hover:bg-muted transition-colors'
                    classList={{ 'cursor-pointer': !!props.onRowClick }}
                    onClick={() => props.onRowClick?.(row.original)}
                  >
                    <For each={row.getVisibleCells()}>
                      {cell => (
                        <td class='text-foreground px-4 py-2 text-sm whitespace-nowrap'>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Show when={props.enablePagination && table.getPageCount() > 1}>
        <div class='flex items-center justify-between px-2'>
          <span class='text-muted-foreground text-sm'>
            Showing{' '}
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              props.data?.length || 0,
            )}{' '}
            of {props.data?.length || 0} results
          </span>
          <div class='flex gap-2'>
            <button
              type='button'
              class='border-border bg-card text-secondary-foreground hover:bg-muted rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Previous
            </button>
            <button
              type='button'
              class='border-border bg-card text-secondary-foreground hover:bg-muted rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default AdminDataTable;
