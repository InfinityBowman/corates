/**
 * Admin Database Viewer route
 * Read-only browser for D1 tables with schema annotations,
 * sortable columns, offset-based pagination, and FK navigation.
 */

import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  DatabaseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  KeyRoundIcon,
  LinkIcon,
  LoaderIcon,
  TableIcon,
  XIcon,
} from 'lucide-react';
import { useAdminStore } from '@/stores/adminStore';
import {
  useAdminDatabaseTables,
  useAdminTableRows,
  useAdminTableSchema,
} from '@/hooks/useAdminQueries';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { DashboardHeader } from '@/components/admin/ui';

export const Route = (createFileRoute as unknown as Function)('/_app/_protected/admin/database')({
  component: DatabaseViewerPage,
});

const LIMIT_OPTIONS = [25, 50, 100];

interface TableInfo {
  name: string;
  rowCount?: number;
}

interface ColumnSchema {
  name: string;
  type?: string;
  primaryKey?: boolean;
  foreignKey?: { table: string; column: string } | null;
}

interface TableRowsData {
  rows: Array<Record<string, unknown>>;
  pagination: {
    page: number;
    limit: number;
    totalRows: number;
    totalPages: number;
  };
}

interface TablesData {
  tables: TableInfo[];
}

interface SchemaData {
  columns: ColumnSchema[];
}

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  const str = String(value);
  return str.length > 100 ? str.substring(0, 100) + '...' : str;
};

function DatabaseViewerPage() {
  const { isAdmin, isAdminChecked } = useAdminStore();

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [orderBy, setOrderBy] = useState('id');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState<string | null>(null);

  const tablesQuery = useAdminDatabaseTables();
  const tables = ((tablesQuery.data as TablesData | undefined)?.tables ?? []) as TableInfo[];

  const schemaQuery = useAdminTableSchema(selectedTable);
  const schemaColumns = useMemo(
    () => ((schemaQuery.data as SchemaData | undefined)?.columns ?? []) as ColumnSchema[],
    [schemaQuery.data],
  );

  const rowsQuery = useAdminTableRows({
    tableName: selectedTable ?? undefined,
    page,
    limit,
    orderBy,
    order,
    filterBy: filterColumn,
    filterValue,
  });

  const rowsData = rowsQuery.data as TableRowsData | undefined;
  const rows = useMemo(() => rowsData?.rows ?? [], [rowsData]);
  const pagination = rowsData?.pagination ?? {
    page: 1,
    limit: 50,
    totalRows: 0,
    totalPages: 0,
  };

  const columns = useMemo(() => {
    const firstRow = rows[0];
    return firstRow ? Object.keys(firstRow) : [];
  }, [rows]);

  const columnSchemaMap = useMemo(() => {
    const map: Record<string, ColumnSchema> = {};
    for (const col of schemaColumns) {
      map[col.name] = col;
    }
    return map;
  }, [schemaColumns]);

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setPage(1);
    setOrderBy('id');
    setOrder('desc');
    setFilterColumn(null);
    setFilterValue(null);
  };

  const navigateToForeignKey = (targetTable: string, columnName: string, value: unknown) => {
    setSelectedTable(targetTable);
    setPage(1);
    setOrderBy(columnName);
    setOrder('desc');
    setFilterColumn(columnName);
    setFilterValue(String(value));
  };

  const clearFilter = () => {
    setFilterColumn(null);
    setFilterValue(null);
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (orderBy === column) {
      setOrder(order === 'desc' ? 'asc' : 'desc');
    } else {
      setOrderBy(column);
      setOrder('desc');
    }
    setPage(1);
  };

  if (!isAdminChecked) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <LoaderIcon className='h-8 w-8 animate-spin text-blue-600' />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className='text-muted-foreground flex min-h-[400px] flex-col items-center justify-center'>
        <AlertCircleIcon className='mb-4 h-12 w-12' />
        <p className='text-lg font-medium'>Access Denied</p>
        <p className='text-sm'>You do not have admin privileges.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <DashboardHeader
        icon={DatabaseIcon}
        title='Database Viewer'
        description='Browse D1 tables and data (read-only)'
        iconColor='purple'
      />

      <div className='flex gap-6'>
        {/* Table List Sidebar */}
        <div className='w-64 shrink-0'>
          <div className='border-border bg-card rounded-lg border'>
            <div className='border-border flex items-center justify-between border-b px-4 py-3'>
              <h2 className='text-foreground font-semibold'>Tables</h2>
              <button
                type='button'
                onClick={() => tablesQuery.refetch()}
                className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded p-1'
                disabled={tablesQuery.isFetching}
                title='Refresh tables'
              >
                <RefreshCwIcon
                  className={`h-4 w-4 ${tablesQuery.isFetching ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
            {tablesQuery.isLoading ?
              <div className='flex justify-center p-4'>
                <LoaderIcon className='h-6 w-6 animate-spin text-blue-600' />
              </div>
            : <div className='max-h-[600px] overflow-y-auto'>
                {tables.map(tbl => (
                  <button
                    key={tbl.name}
                    type='button'
                    onClick={() => handleTableSelect(tbl.name)}
                    className={`hover:bg-muted flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                      selectedTable === tbl.name ?
                        'bg-purple-50 text-purple-700'
                      : 'text-secondary-foreground'
                    }`}
                  >
                    <span className='flex items-center gap-2'>
                      <TableIcon className='h-4 w-4' />
                      {tbl.name}
                    </span>
                    <span className='text-muted-foreground/70 text-xs'>{tbl.rowCount}</span>
                  </button>
                ))}
              </div>
            }
          </div>
        </div>

        {/* Table Content */}
        <div className='min-w-0 flex-1'>
          {selectedTable ?
            <div className='border-border bg-card rounded-lg border'>
              {/* Table Header */}
              <div className='border-border flex items-center justify-between border-b px-4 py-3'>
                <div className='flex items-center gap-3'>
                  <h2 className='text-foreground font-semibold'>{selectedTable}</h2>
                  {filterColumn && (
                    <span className='flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700'>
                      <LinkIcon className='h-3 w-3' />
                      {filterColumn} = {filterValue}
                      <button
                        type='button'
                        onClick={clearFilter}
                        className='ml-1 rounded-full p-0.5 hover:bg-blue-200'
                        title='Clear filter'
                      >
                        <XIcon className='h-3 w-3' />
                      </button>
                    </span>
                  )}
                </div>
                <div className='flex items-center gap-4'>
                  <select
                    value={limit}
                    onChange={e => {
                      setLimit(parseInt(e.target.value, 10));
                      setPage(1);
                    }}
                    className='border-border rounded border px-2 py-1 text-sm'
                  >
                    {LIMIT_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>
                        {opt} rows
                      </option>
                    ))}
                  </select>
                  <button
                    type='button'
                    onClick={() => rowsQuery.refetch()}
                    className='bg-secondary hover:bg-secondary/80 flex items-center gap-1 rounded px-3 py-1 text-sm disabled:opacity-50'
                    disabled={rowsQuery.isFetching}
                  >
                    <RefreshCwIcon
                      className={`h-3 w-3 ${rowsQuery.isFetching ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Table Data */}
              {rowsQuery.isLoading ?
                <div className='flex justify-center p-8'>
                  <LoaderIcon className='h-6 w-6 animate-spin text-blue-600' />
                </div>
              : rows.length > 0 ?
                <>
                  <div className='overflow-x-auto'>
                    <table className='divide-border min-w-full divide-y'>
                      <thead className='bg-muted'>
                        <tr>
                          {columns.map(col => {
                            const schema = columnSchemaMap[col];
                            return (
                              <th
                                key={col}
                                className='text-muted-foreground hover:bg-secondary cursor-pointer px-4 py-2 text-left text-xs font-medium tracking-wider uppercase'
                                onClick={() => handleSort(col)}
                              >
                                <span className='flex items-center gap-1'>
                                  {schema?.primaryKey && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className='inline-flex'>
                                          <KeyRoundIcon className='h-3 w-3 text-amber-500' />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>Primary Key</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {schema?.foreignKey && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className='inline-flex'>
                                          <LinkIcon className='h-3 w-3 text-blue-500' />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        FK: {schema.foreignKey.table}.{schema.foreignKey.column}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {col}
                                  {schema?.type && (
                                    <span className='bg-secondary text-muted-foreground ml-1 rounded px-1 py-0.5 text-[10px] font-normal normal-case'>
                                      {schema.type}
                                    </span>
                                  )}
                                  {orderBy === col &&
                                    (order === 'desc' ?
                                      <ArrowDownIcon className='h-3 w-3' />
                                    : <ArrowUpIcon className='h-3 w-3' />)}
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className='divide-border bg-card divide-y'>
                        {rows.map((row, rowIdx) => (
                          <tr key={rowIdx} className='hover:bg-muted'>
                            {columns.map(col => {
                              const schema = columnSchemaMap[col];
                              const cellValue = row[col];
                              const fk = schema?.foreignKey;

                              return (
                                <td
                                  key={col}
                                  className='text-secondary-foreground max-w-xs truncate px-4 py-2 text-sm whitespace-nowrap'
                                >
                                  {fk && cellValue != null ?
                                    <button
                                      type='button'
                                      onClick={() =>
                                        navigateToForeignKey(fk.table, fk.column, cellValue)
                                      }
                                      className='text-blue-600 underline decoration-dotted hover:text-blue-800'
                                      title={`View in ${fk.table}`}
                                    >
                                      {formatCellValue(cellValue)}
                                    </button>
                                  : formatCellValue(cellValue)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className='border-border flex items-center justify-between border-t px-4 py-3'>
                    <span className='text-muted-foreground text-sm'>
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.totalRows)} of{' '}
                      {pagination.totalRows} rows
                    </span>
                    <div className='flex gap-2'>
                      <button
                        type='button'
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className='border-border hover:bg-secondary rounded border p-1 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <ChevronLeftIcon className='h-5 w-5' />
                      </button>
                      <span className='flex items-center px-2 text-sm'>
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <button
                        type='button'
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= pagination.totalPages}
                        className='border-border hover:bg-secondary rounded border p-1 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <ChevronRightIcon className='h-5 w-5' />
                      </button>
                    </div>
                  </div>
                </>
              : <div className='text-muted-foreground flex justify-center p-8'>
                  <p>No rows in this table</p>
                </div>
              }
            </div>
          : <div className='border-border bg-muted flex h-64 items-center justify-center rounded-lg border border-dashed'>
              <p className='text-muted-foreground'>Select a table to view its contents</p>
            </div>
          }
        </div>
      </div>
    </TooltipProvider>
  );
}
