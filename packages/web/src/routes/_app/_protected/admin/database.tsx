import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  RefreshCwIcon,
  KeyRoundIcon,
  LinkIcon,
  XIcon,
} from 'lucide-react';
import {
  useAdminDatabaseTables,
  useAdminTableRows,
  useAdminTableSchema,
} from '@/hooks/useAdminQueries';
import type { AdminTableColumn } from '@/server/functions/admin-database.server';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  AdminEmpty,
  AdminPage,
  AdminPanel,
  AdminStat,
  AdminStatRow,
  ADMIN_TH,
} from '@/components/admin/ui';
import { navRowClass } from '@/components/layout/navStyles';
import { formatFileSize } from '@corates/shared';

export const Route = createFileRoute('/_app/_protected/admin/database')({
  component: DatabaseViewerPage,
});

const LIMIT_OPTIONS = [25, 50, 100];

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  const str = String(value);
  return str.length > 100 ? str.substring(0, 100) + '...' : str;
};

function DatabaseViewerPage() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [orderBy, setOrderBy] = useState('id');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState<string | null>(null);

  const tablesQuery = useAdminDatabaseTables();
  const tables = tablesQuery.data?.tables ?? [];
  const databaseSizeBytes = tablesQuery.data?.databaseSizeBytes ?? 0;
  const totalRows = tablesQuery.data?.totalRows ?? 0;

  const schemaQuery = useAdminTableSchema(selectedTable);
  const schemaColumns = useMemo(() => schemaQuery.data?.columns ?? [], [schemaQuery.data]);

  const rowsQuery = useAdminTableRows({
    tableName: selectedTable ?? undefined,
    page,
    limit,
    orderBy,
    order,
    filterBy: filterColumn,
    filterValue,
  });

  const rowsData = rowsQuery.data;
  // The viewer renders whatever table was picked at runtime, so the rows are
  // read by column name rather than as one known shape.
  const rows = useMemo(() => (rowsData?.rows ?? []) as Record<string, unknown>[], [rowsData]);
  const pagination = rowsData?.pagination ?? { page: 1, limit, totalRows: 0, totalPages: 0 };

  const columns = useMemo(() => {
    const firstRow = rows[0];
    return firstRow ? Object.keys(firstRow) : [];
  }, [rows]);

  const columnSchemaMap = useMemo(() => {
    const map: Record<string, AdminTableColumn> = {};
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

  const handleSort = (column: string) => {
    if (orderBy === column) {
      setOrder(order === 'desc' ? 'asc' : 'desc');
    } else {
      setOrderBy(column);
      setOrder('desc');
    }
    setPage(1);
  };

  return (
    <AdminPage title='Database' description='Browse D1 tables and rows (read-only)'>
      <AdminStatRow className='lg:grid-cols-3'>
        <AdminStat
          label='Database size'
          value={formatFileSize(databaseSizeBytes)}
          loading={tablesQuery.isLoading}
        />
        <AdminStat
          label='Total rows'
          value={totalRows.toLocaleString()}
          hint='Across the tables listed'
          loading={tablesQuery.isLoading}
        />
        <AdminStat
          label='Tables'
          value={tables.length}
          hint='Browsable in the viewer'
          loading={tablesQuery.isLoading}
        />
      </AdminStatRow>

      <div className='flex flex-col gap-6 lg:flex-row'>
        <AdminPanel
          title='Tables'
          className='lg:w-60 lg:shrink-0'
          bodyClassName='max-h-150 overflow-y-auto p-1.5'
          action={
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              onClick={() => tablesQuery.refetch()}
              disabled={tablesQuery.isFetching}
              className='text-muted-foreground/70 hover:text-foreground'
              aria-label='Refresh tables'
            >
              <RefreshCwIcon
                className={`size-3.5 ${tablesQuery.isFetching ? 'animate-spin' : ''}`}
              />
            </Button>
          }
        >
          {tablesQuery.isLoading ?
            <div className='flex flex-col gap-1 p-1'>
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className='h-7 w-full' />
              ))}
            </div>
          : tables.map(tbl => (
              <button
                key={tbl.name}
                type='button'
                onClick={() => handleTableSelect(tbl.name)}
                className={`${navRowClass(selectedTable === tbl.name)} justify-between`}
              >
                <span className='truncate'>{tbl.name}</span>
                <span className='text-muted-foreground/70 text-xs tabular-nums'>
                  {tbl.rowCount}
                </span>
              </button>
            ))
          }
        </AdminPanel>

        <div className='min-w-0 flex-1'>
          {!selectedTable ?
            <AdminPanel>
              <AdminEmpty
                title='No table selected'
                description='Pick a table on the left to browse its rows.'
                className='min-h-64'
              />
            </AdminPanel>
          : <AdminPanel
              title={
                <span className='flex items-center gap-2'>
                  <span className='font-mono'>{selectedTable}</span>
                  {filterColumn && (
                    <Badge variant='info'>
                      <LinkIcon />
                      {filterColumn} = {filterValue}
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-xs'
                        onClick={() => {
                          setFilterColumn(null);
                          setFilterValue(null);
                          setPage(1);
                        }}
                        className='ml-0.5 size-4'
                        aria-label='Clear filter'
                      >
                        <XIcon className='size-3' />
                      </Button>
                    </Badge>
                  )}
                </span>
              }
              action={
                <>
                  <Select
                    value={String(limit)}
                    onValueChange={v => {
                      setLimit(Number(v));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className='text-[13px]'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIMIT_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={String(opt)}>
                          {opt} rows
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => rowsQuery.refetch()}
                    disabled={rowsQuery.isFetching}
                    className='text-muted-foreground/70 hover:text-foreground'
                    aria-label='Refresh rows'
                  >
                    <RefreshCwIcon
                      className={`size-3.5 ${rowsQuery.isFetching ? 'animate-spin' : ''}`}
                    />
                  </Button>
                </>
              }
              footer={
                <>
                  <span className='text-muted-foreground text-[13px] tabular-nums'>
                    {pagination.totalRows > 0 ?
                      `${(pagination.page - 1) * pagination.limit + 1}-${Math.min(
                        pagination.page * pagination.limit,
                        pagination.totalRows,
                      )} of ${pagination.totalRows} rows`
                    : 'No rows'}
                  </span>
                  <div className='flex items-center gap-1'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-sm'
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      aria-label='Previous page'
                    >
                      <ChevronLeftIcon className='size-4' />
                    </Button>
                    <span className='text-muted-foreground px-1 text-[13px] tabular-nums'>
                      Page {pagination.page} of {Math.max(1, pagination.totalPages)}
                    </span>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-sm'
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= pagination.totalPages}
                      aria-label='Next page'
                    >
                      <ChevronRightIcon className='size-4' />
                    </Button>
                  </div>
                </>
              }
            >
              {rowsQuery.isLoading ?
                <div className='flex flex-col gap-2 p-4'>
                  {Array.from({ length: 10 }, (_, i) => (
                    <Skeleton key={i} className='h-6 w-full' />
                  ))}
                </div>
              : rows.length === 0 ?
                <AdminEmpty title='No rows in this table' />
              : <Table>
                  <TableHeader className='bg-muted/40'>
                    <TableRow className='border-border hover:bg-transparent'>
                      {columns.map(col => {
                        const schema = columnSchemaMap[col];
                        return (
                          <TableHead
                            key={col}
                            className={`${ADMIN_TH} hover:text-foreground cursor-pointer transition-colors select-none`}
                            onClick={() => handleSort(col)}
                          >
                            <span className='flex items-center gap-1'>
                              {schema?.primaryKey && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <KeyRoundIcon className='text-warning size-3' />
                                  </TooltipTrigger>
                                  <TooltipContent>Primary key</TooltipContent>
                                </Tooltip>
                              )}
                              {schema?.foreignKey && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <LinkIcon className='text-info size-3' />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    FK: {schema.foreignKey.table}.{schema.foreignKey.column}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <span className='font-mono'>{col}</span>
                              {schema?.type && (
                                <span className='text-muted-foreground/60 text-2xs'>
                                  {schema.type}
                                </span>
                              )}
                              <span className='inline-flex size-3 items-center justify-center'>
                                {orderBy === col &&
                                  (order === 'desc' ?
                                    <ArrowDownIcon className='size-3' />
                                  : <ArrowUpIcon className='size-3' />)}
                              </span>
                            </span>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, rowIdx) => (
                      <TableRow key={rowIdx} className='border-border'>
                        {columns.map(col => {
                          const fk = columnSchemaMap[col]?.foreignKey;
                          const cellValue = row[col];
                          return (
                            <TableCell
                              key={col}
                              className='text-foreground h-10 max-w-xs truncate px-3 text-[13px]'
                            >
                              {fk && cellValue != null ?
                                <button
                                  type='button'
                                  onClick={() =>
                                    navigateToForeignKey(fk.table, fk.column, cellValue)
                                  }
                                  className='text-primary hover:text-primary/80 underline decoration-dotted'
                                  title={`View in ${fk.table}`}
                                >
                                  {formatCellValue(cellValue)}
                                </button>
                              : formatCellValue(cellValue)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              }
            </AdminPanel>
          }
        </div>
      </div>
    </AdminPage>
  );
}
