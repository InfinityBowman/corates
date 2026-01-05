/**
 * Database Viewer - Admin interface for viewing D1 tables and rows
 * Read-only access for debugging and observability
 */

import { createSignal, Show, For, createMemo } from 'solid-js';
import {
  FiDatabase,
  FiChevronLeft,
  FiChevronRight,
  FiArrowUp,
  FiArrowDown,
  FiAlertCircle,
  FiRefreshCw,
} from 'solid-icons/fi';
import { BiRegularTable } from 'solid-icons/bi';
import { isAdmin, isAdminChecked } from '@/stores/adminStore.js';
import { useAdminDatabaseTables, useAdminTableRows } from '@primitives/useAdminQueries.js';
import { Spinner } from '@corates/ui';

const LIMIT_OPTIONS = [25, 50, 100];

export default function DatabaseViewer() {
  const [selectedTable, setSelectedTable] = createSignal(null);
  const [page, setPage] = createSignal(1);
  const [limit, setLimit] = createSignal(50);
  const [orderBy, setOrderBy] = createSignal('id');
  const [order, setOrder] = createSignal('desc');

  const tablesQuery = useAdminDatabaseTables();
  const tables = () => tablesQuery.data?.tables || [];

  const rowsQuery = useAdminTableRows(() => ({
    tableName: selectedTable(),
    page: page(),
    limit: limit(),
    orderBy: orderBy(),
    order: order(),
  }));

  const rows = () => rowsQuery.data?.rows || [];
  const pagination = () => rowsQuery.data?.pagination || {};

  // Get column names from first row
  const columns = createMemo(() => {
    const firstRow = rows()[0];
    return firstRow ? Object.keys(firstRow) : [];
  });

  const handleTableSelect = tableName => {
    setSelectedTable(tableName);
    setPage(1);
    setOrderBy('id');
    setOrder('desc');
  };

  const handleSort = column => {
    if (orderBy() === column) {
      setOrder(order() === 'desc' ? 'asc' : 'desc');
    } else {
      setOrderBy(column);
      setOrder('desc');
    }
    setPage(1);
  };

  const formatCellValue = value => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    const str = String(value);
    return str.length > 100 ? str.substring(0, 100) + '...' : str;
  };

  return (
    <Show
      when={isAdminChecked()}
      fallback={
        <div class='flex min-h-100 items-center justify-center'>
          <Spinner size='lg' />
        </div>
      }
    >
      <Show
        when={isAdmin()}
        fallback={
          <div class='flex min-h-100 flex-col items-center justify-center text-gray-500'>
            <FiAlertCircle class='mb-4 h-12 w-12' />
            <p class='text-lg font-medium'>Access Denied</p>
            <p class='text-sm'>You do not have admin privileges.</p>
          </div>
        }
      >
        {/* Header */}
        <div class='mb-6 flex items-center space-x-3'>
          <div class='flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100'>
            <FiDatabase class='h-6 w-6 text-purple-600' />
          </div>
          <div>
            <h1 class='text-2xl font-bold text-gray-900'>Database Viewer</h1>
            <p class='text-sm text-gray-500'>Browse D1 tables and data (read-only)</p>
          </div>
        </div>

        <div class='flex gap-6'>
          {/* Table List Sidebar */}
          <div class='w-64 shrink-0'>
            <div class='rounded-lg border border-gray-200 bg-white'>
              <div class='flex items-center justify-between border-b border-gray-200 px-4 py-3'>
                <h2 class='font-semibold text-gray-900'>Tables</h2>
                <button
                  onClick={() => tablesQuery.refetch()}
                  class='rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  disabled={tablesQuery.isFetching}
                  title='Refresh tables'
                >
                  <FiRefreshCw class={`h-4 w-4 ${tablesQuery.isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <Show
                when={!tablesQuery.isLoading}
                fallback={
                  <div class='flex justify-center p-4'>
                    <Spinner size='sm' />
                  </div>
                }
              >
                <div class='max-h-150 overflow-y-auto'>
                  <For each={tables()}>
                    {table => (
                      <button
                        onClick={() => handleTableSelect(table.name)}
                        class={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                          selectedTable() === table.name ?
                            'bg-purple-50 text-purple-700'
                          : 'text-gray-700'
                        }`}
                      >
                        <span class='flex items-center gap-2'>
                          <BiRegularTable class='h-4 w-4' />
                          {table.name}
                        </span>
                        <span class='text-xs text-gray-400'>{table.rowCount}</span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          {/* Table Content */}
          <div class='min-w-0 flex-1'>
            <Show
              when={selectedTable()}
              fallback={
                <div class='flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50'>
                  <p class='text-gray-500'>Select a table to view its contents</p>
                </div>
              }
            >
              <div class='rounded-lg border border-gray-200 bg-white'>
                {/* Table Header */}
                <div class='flex items-center justify-between border-b border-gray-200 px-4 py-3'>
                  <h2 class='font-semibold text-gray-900'>{selectedTable()}</h2>
                  <div class='flex items-center gap-4'>
                    <select
                      value={limit()}
                      onChange={e => {
                        setLimit(parseInt(e.target.value, 10));
                        setPage(1);
                      }}
                      class='rounded border border-gray-300 px-2 py-1 text-sm'
                    >
                      <For each={LIMIT_OPTIONS}>
                        {opt => <option value={opt}>{opt} rows</option>}
                      </For>
                    </select>
                    <button
                      onClick={() => rowsQuery.refetch()}
                      class='flex items-center gap-1 rounded bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200 disabled:opacity-50'
                      disabled={rowsQuery.isFetching}
                    >
                      <FiRefreshCw
                        class={`h-3 w-3 ${rowsQuery.isFetching ? 'animate-spin' : ''}`}
                      />
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Table Data */}
                <Show
                  when={!rowsQuery.isLoading}
                  fallback={
                    <div class='flex justify-center p-8'>
                      <Spinner size='md' />
                    </div>
                  }
                >
                  <Show
                    when={rows().length > 0}
                    fallback={
                      <div class='flex justify-center p-8 text-gray-500'>
                        <p>No rows in this table</p>
                      </div>
                    }
                  >
                    <div class='overflow-x-auto'>
                      <table class='min-w-full divide-y divide-gray-200'>
                        <thead class='bg-gray-50'>
                          <tr>
                            <For each={columns()}>
                              {col => (
                                <th
                                  class='cursor-pointer px-4 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:bg-gray-100'
                                  onClick={() => handleSort(col)}
                                >
                                  <span class='flex items-center gap-1'>
                                    {col}
                                    <Show when={orderBy() === col}>
                                      {order() === 'desc' ?
                                        <FiArrowDown class='h-3 w-3' />
                                      : <FiArrowUp class='h-3 w-3' />}
                                    </Show>
                                  </span>
                                </th>
                              )}
                            </For>
                          </tr>
                        </thead>
                        <tbody class='divide-y divide-gray-200 bg-white'>
                          <For each={rows()}>
                            {row => (
                              <tr class='hover:bg-gray-50'>
                                <For each={columns()}>
                                  {col => (
                                    <td class='max-w-xs truncate px-4 py-2 text-sm whitespace-nowrap text-gray-700'>
                                      {formatCellValue(row[col])}
                                    </td>
                                  )}
                                </For>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div class='flex items-center justify-between border-t border-gray-200 px-4 py-3'>
                      <span class='text-sm text-gray-500'>
                        Showing {(pagination().page - 1) * pagination().limit + 1} to{' '}
                        {Math.min(pagination().page * pagination().limit, pagination().totalRows)}{' '}
                        of {pagination().totalRows} rows
                      </span>
                      <div class='flex gap-2'>
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page() <= 1}
                          class='rounded border border-gray-300 p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          <FiChevronLeft class='h-5 w-5' />
                        </button>
                        <span class='flex items-center px-2 text-sm'>
                          Page {pagination().page} of {pagination().totalPages}
                        </span>
                        <button
                          onClick={() => setPage(p => p + 1)}
                          disabled={page() >= pagination().totalPages}
                          class='rounded border border-gray-300 p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          <FiChevronRight class='h-5 w-5' />
                        </button>
                      </div>
                    </div>
                  </Show>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </Show>
  );
}
