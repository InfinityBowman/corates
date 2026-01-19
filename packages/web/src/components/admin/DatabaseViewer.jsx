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
  FiKey,
  FiLink,
} from 'solid-icons/fi';
import { BiRegularTable } from 'solid-icons/bi';
import { isAdmin, isAdminChecked } from '@/stores/adminStore.js';
import {
  useAdminDatabaseTables,
  useAdminTableRows,
  useAdminTableSchema,
} from '@primitives/useAdminQueries.js';
import { Spinner } from '@/components/ui/spinner';
import {
  Tooltip,
  TooltipTrigger,
  TooltipPositioner,
  TooltipContent,
} from '@/components/ui/tooltip';
import { DashboardHeader } from './ui/index.js';

const LIMIT_OPTIONS = [25, 50, 100];

export default function DatabaseViewer() {
  const [selectedTable, setSelectedTable] = createSignal(null);
  const [page, setPage] = createSignal(1);
  const [limit, setLimit] = createSignal(50);
  const [orderBy, setOrderBy] = createSignal('id');
  const [order, setOrder] = createSignal('desc');
  const [filterColumn, setFilterColumn] = createSignal(null);
  const [filterValue, setFilterValue] = createSignal(null);

  const tablesQuery = useAdminDatabaseTables();
  const tables = () => tablesQuery.data?.tables || [];

  const schemaQuery = useAdminTableSchema(selectedTable);
  const schemaColumns = () => schemaQuery.data?.columns || [];

  const rowsQuery = useAdminTableRows(() => ({
    tableName: selectedTable(),
    page: page(),
    limit: limit(),
    orderBy: orderBy(),
    order: order(),
    filterBy: filterColumn(),
    filterValue: filterValue(),
  }));

  const rows = () => rowsQuery.data?.rows || [];
  const pagination = () => rowsQuery.data?.pagination || {};

  // Get column names from first row
  const columns = createMemo(() => {
    const firstRow = rows()[0];
    return firstRow ? Object.keys(firstRow) : [];
  });

  // Build a map of column name to schema info for quick lookup
  const columnSchemaMap = createMemo(() => {
    const map = {};
    for (const col of schemaColumns()) {
      map[col.name] = col;
    }
    return map;
  });

  const handleTableSelect = tableName => {
    setSelectedTable(tableName);
    setPage(1);
    setOrderBy('id');
    setOrder('desc');
    setFilterColumn(null);
    setFilterValue(null);
  };

  // Navigate to a foreign key reference
  const navigateToForeignKey = (targetTable, columnName, value) => {
    setSelectedTable(targetTable);
    setPage(1);
    setOrderBy(columnName);
    setOrder('desc');
    setFilterColumn(columnName);
    setFilterValue(value);
  };

  // Clear active filter
  const clearFilter = () => {
    setFilterColumn(null);
    setFilterValue(null);
    setPage(1);
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
          <div class='text-muted-foreground flex min-h-100 flex-col items-center justify-center'>
            <FiAlertCircle class='mb-4 h-12 w-12' />
            <p class='text-lg font-medium'>Access Denied</p>
            <p class='text-sm'>You do not have admin privileges.</p>
          </div>
        }
      >
        <DashboardHeader
          icon={FiDatabase}
          title='Database Viewer'
          description='Browse D1 tables and data (read-only)'
          iconColor='purple'
        />

        <div class='flex gap-6'>
          {/* Table List Sidebar */}
          <div class='w-64 shrink-0'>
            <div class='border-border bg-card rounded-lg border'>
              <div class='border-border flex items-center justify-between border-b px-4 py-3'>
                <h2 class='text-foreground font-semibold'>Tables</h2>
                <button
                  onClick={() => tablesQuery.refetch()}
                  class='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded p-1'
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
                        class={`hover:bg-muted flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                          selectedTable() === table.name ?
                            'bg-purple-50 text-purple-700'
                          : 'text-secondary-foreground'
                        }`}
                      >
                        <span class='flex items-center gap-2'>
                          <BiRegularTable class='h-4 w-4' />
                          {table.name}
                        </span>
                        <span class='text-muted-foreground/70 text-xs'>{table.rowCount}</span>
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
                <div class='border-border bg-muted flex h-64 items-center justify-center rounded-lg border border-dashed'>
                  <p class='text-muted-foreground'>Select a table to view its contents</p>
                </div>
              }
            >
              <div class='border-border bg-card rounded-lg border'>
                {/* Table Header */}
                <div class='border-border flex items-center justify-between border-b px-4 py-3'>
                  <div class='flex items-center gap-3'>
                    <h2 class='text-foreground font-semibold'>{selectedTable()}</h2>
                    <Show when={filterColumn()}>
                      <span class='flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700'>
                        <FiLink class='h-3 w-3' />
                        {filterColumn()} = {filterValue()}
                        <button
                          onClick={clearFilter}
                          class='ml-1 rounded-full p-0.5 hover:bg-blue-200'
                          title='Clear filter'
                        >
                          <svg
                            class='h-3 w-3'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            stroke-width='2'
                          >
                            <path d='M18 6L6 18M6 6l12 12' />
                          </svg>
                        </button>
                      </span>
                    </Show>
                  </div>
                  <div class='flex items-center gap-4'>
                    <select
                      value={limit()}
                      onChange={e => {
                        setLimit(parseInt(e.target.value, 10));
                        setPage(1);
                      }}
                      class='border-border rounded border px-2 py-1 text-sm'
                    >
                      <For each={LIMIT_OPTIONS}>
                        {opt => <option value={opt}>{opt} rows</option>}
                      </For>
                    </select>
                    <button
                      onClick={() => rowsQuery.refetch()}
                      class='bg-secondary hover:bg-secondary flex items-center gap-1 rounded px-3 py-1 text-sm disabled:opacity-50'
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
                      <div class='text-muted-foreground flex justify-center p-8'>
                        <p>No rows in this table</p>
                      </div>
                    }
                  >
                    <div class='overflow-x-auto'>
                      <table class='divide-border min-w-full divide-y'>
                        <thead class='bg-muted'>
                          <tr>
                            <For each={columns()}>
                              {col => {
                                const schema = () => columnSchemaMap()[col];
                                return (
                                  <th
                                    class='text-muted-foreground hover:bg-secondary cursor-pointer px-4 py-2 text-left text-xs font-medium tracking-wider uppercase'
                                    onClick={() => handleSort(col)}
                                  >
                                    <span class='flex items-center gap-1'>
                                      <Show when={schema()?.primaryKey}>
                                        <Tooltip openDelay={100}>
                                          <TooltipTrigger>
                                            <span class='inline-flex'>
                                              <FiKey class='h-3 w-3 text-amber-500' />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipPositioner>
                                            <TooltipContent>Primary Key</TooltipContent>
                                          </TooltipPositioner>
                                        </Tooltip>
                                      </Show>
                                      <Show when={schema()?.foreignKey}>
                                        <Tooltip openDelay={100}>
                                          <TooltipTrigger>
                                            <span class='inline-flex'>
                                              <FiLink class='h-3 w-3 text-blue-500' />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipPositioner>
                                            <TooltipContent>
                                              FK: {schema().foreignKey.table}.
                                              {schema().foreignKey.column}
                                            </TooltipContent>
                                          </TooltipPositioner>
                                        </Tooltip>
                                      </Show>
                                      {col}
                                      <Show when={schema()?.type}>
                                        <span class='text-2xs bg-secondary text-muted-foreground ml-1 rounded px-1 py-0.5 font-normal normal-case'>
                                          {schema().type}
                                        </span>
                                      </Show>
                                      <Show when={orderBy() === col}>
                                        {order() === 'desc' ?
                                          <FiArrowDown class='h-3 w-3' />
                                        : <FiArrowUp class='h-3 w-3' />}
                                      </Show>
                                    </span>
                                  </th>
                                );
                              }}
                            </For>
                          </tr>
                        </thead>
                        <tbody class='divide-border bg-card divide-y'>
                          <For each={rows()}>
                            {row => (
                              <tr class='hover:bg-muted'>
                                <For each={columns()}>
                                  {col => {
                                    const schema = () => columnSchemaMap()[col];
                                    const cellValue = row[col];
                                    const fk = () => schema()?.foreignKey;

                                    return (
                                      <td class='text-secondary-foreground max-w-xs truncate px-4 py-2 text-sm whitespace-nowrap'>
                                        <Show
                                          when={fk() && cellValue != null}
                                          fallback={formatCellValue(cellValue)}
                                        >
                                          <button
                                            onClick={() =>
                                              navigateToForeignKey(
                                                fk().table,
                                                fk().column,
                                                cellValue,
                                              )
                                            }
                                            class='text-blue-600 underline decoration-dotted hover:text-blue-800'
                                            title={`View in ${fk().table}`}
                                          >
                                            {formatCellValue(cellValue)}
                                          </button>
                                        </Show>
                                      </td>
                                    );
                                  }}
                                </For>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div class='border-border flex items-center justify-between border-t px-4 py-3'>
                      <span class='text-muted-foreground text-sm'>
                        Showing {(pagination().page - 1) * pagination().limit + 1} to{' '}
                        {Math.min(pagination().page * pagination().limit, pagination().totalRows)}{' '}
                        of {pagination().totalRows} rows
                      </span>
                      <div class='flex gap-2'>
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page() <= 1}
                          class='border-border hover:bg-secondary rounded border p-1 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          <FiChevronLeft class='h-5 w-5' />
                        </button>
                        <span class='flex items-center px-2 text-sm'>
                          Page {pagination().page} of {pagination().totalPages}
                        </span>
                        <button
                          onClick={() => setPage(p => p + 1)}
                          disabled={page() >= pagination().totalPages}
                          class='border-border hover:bg-secondary rounded border p-1 disabled:cursor-not-allowed disabled:opacity-50'
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
