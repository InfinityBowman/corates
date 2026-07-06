import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  DatabaseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  RefreshCwIcon,
  KeyRoundIcon,
  LinkIcon,
  LoaderIcon,
  TableIcon,
  XIcon,
} from 'lucide-react';
import {
  useAdminDatabaseTables,
  useAdminTableRows,
  useAdminTableSchema,
} from '@/hooks/useAdminQueries';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { DashboardHeader, AdminBox } from '@/components/admin/ui';

export const Route = createFileRoute('/_app/_protected/admin/database')({
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

  return (
    <div className='flex flex-col gap-8'>
      <DashboardHeader
        icon={DatabaseIcon}
        title='Database Viewer'
        description='Browse D1 tables and data (read-only)'
        iconColor='purple'
      />

      <div className='flex gap-6'>
        {/* Table List Sidebar */}
        <div className='w-64 shrink-0'>
          <AdminBox className='p-0'>
            <div className='border-border flex items-center justify-between border-b px-4 py-3'>
              <h2 className='text-foreground font-semibold'>Tables</h2>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={() => tablesQuery.refetch()}
                disabled={tablesQuery.isFetching}
                title='Refresh tables'
              >
                <RefreshCwIcon
                  className={`size-4 ${tablesQuery.isFetching ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
            {tablesQuery.isLoading ?
              <div className='flex justify-center p-4'>
                <LoaderIcon className='text-primary size-6 animate-spin' />
              </div>
            : <div className='max-h-150 overflow-y-auto'>
                {tables.map(tbl => (
                  <Button
                    key={tbl.name}
                    type='button'
                    variant='ghost'
                    onClick={() => handleTableSelect(tbl.name)}
                    className={`h-auto w-full justify-between rounded-none px-4 py-2 text-left text-sm ${
                      selectedTable === tbl.name ?
                        'bg-chart-cat-5/15 text-chart-cat-5 hover:bg-chart-cat-5/15 hover:text-chart-cat-5'
                      : 'text-secondary-foreground'
                    }`}
                  >
                    <span className='flex items-center gap-2'>
                      <TableIcon className='size-4' />
                      {tbl.name}
                    </span>
                    <span className='text-muted-foreground/70 text-xs'>{tbl.rowCount}</span>
                  </Button>
                ))}
              </div>
            }
          </AdminBox>
        </div>

        {/* Table Content */}
        <div className='min-w-0 flex-1'>
          {selectedTable ?
            <AdminBox className='overflow-hidden p-0'>
              {/* Table Header */}
              <div className='border-border flex items-center justify-between border-b px-4 py-3'>
                <div className='flex items-center gap-3'>
                  <h2 className='text-foreground font-semibold'>{selectedTable}</h2>
                  {filterColumn && (
                    <Badge variant='info'>
                      <LinkIcon />
                      {filterColumn} = {filterValue}
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-xs'
                        onClick={clearFilter}
                        className='hover:bg-info-border ml-1 size-4'
                        title='Clear filter'
                      >
                        <XIcon className='size-3' />
                      </Button>
                    </Badge>
                  )}
                </div>
                <div className='flex items-center gap-4'>
                  <Select
                    value={String(limit)}
                    onValueChange={v => {
                      setLimit(Number(v));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
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
                    variant='secondary'
                    onClick={() => rowsQuery.refetch()}
                    disabled={rowsQuery.isFetching}
                  >
                    <RefreshCwIcon
                      className={`size-3 ${rowsQuery.isFetching ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Table Data */}
              {rowsQuery.isLoading ?
                <div className='flex justify-center p-8'>
                  <LoaderIcon className='text-primary size-6 animate-spin' />
                </div>
              : rows.length > 0 ?
                <>
                  <Table className='min-w-full'>
                    <TableHeader className='bg-muted'>
                      <TableRow>
                        {columns.map(col => {
                          const schema = columnSchemaMap[col];
                          return (
                            <TableHead
                              key={col}
                              className='text-muted-foreground hover:bg-secondary cursor-pointer px-4 py-2 text-xs font-medium tracking-wider uppercase'
                              onClick={() => handleSort(col)}
                            >
                              <span className='flex items-center gap-1'>
                                {schema?.primaryKey && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className='inline-flex'>
                                        <KeyRoundIcon className='text-warning size-3' />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Primary Key</TooltipContent>
                                  </Tooltip>
                                )}
                                {schema?.foreignKey && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className='inline-flex'>
                                        <LinkIcon className='text-info size-3' />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      FK: {schema.foreignKey.table}.{schema.foreignKey.column}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {col}
                                {schema?.type && (
                                  <span className='bg-secondary text-muted-foreground text-2xs ml-1 rounded px-1 py-0.5 font-normal normal-case'>
                                    {schema.type}
                                  </span>
                                )}
                                {orderBy === col &&
                                  (order === 'desc' ?
                                    <ArrowDownIcon className='size-3' />
                                  : <ArrowUpIcon className='size-3' />)}
                              </span>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody className='bg-card'>
                      {rows.map((row, rowIdx) => (
                        <TableRow key={rowIdx}>
                          {columns.map(col => {
                            const schema = columnSchemaMap[col];
                            const cellValue = row[col];
                            const fk = schema?.foreignKey;

                            return (
                              <TableCell
                                key={col}
                                className='text-secondary-foreground max-w-xs truncate px-4 py-2 text-sm'
                              >
                                {fk && cellValue != null ?
                                  <Button
                                    type='button'
                                    variant='link'
                                    onClick={() =>
                                      navigateToForeignKey(fk.table, fk.column, cellValue)
                                    }
                                    className='hover:text-primary/80 h-auto p-0 underline decoration-dotted'
                                    title={`View in ${fk.table}`}
                                  >
                                    {formatCellValue(cellValue)}
                                  </Button>
                                : formatCellValue(cellValue)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className='border-border flex items-center justify-between border-t px-4 py-3'>
                    <span className='text-muted-foreground text-sm'>
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.totalRows)} of{' '}
                      {pagination.totalRows} rows
                    </span>
                    <div className='flex gap-2'>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        <ChevronLeftIcon className='size-5' />
                      </Button>
                      <span className='flex items-center px-2 text-sm'>
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= pagination.totalPages}
                      >
                        <ChevronRightIcon className='size-5' />
                      </Button>
                    </div>
                  </div>
                </>
              : <div className='text-muted-foreground flex justify-center p-8'>
                  <p>No rows in this table</p>
                </div>
              }
            </AdminBox>
          : <div className='border-border bg-muted flex h-64 items-center justify-center rounded-xl border border-dashed'>
              <p className='text-muted-foreground'>Select a table to view its contents</p>
            </div>
          }
        </div>
      </div>
    </div>
  );
}
