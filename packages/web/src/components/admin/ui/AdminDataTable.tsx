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

// V9 resolves the default 'auto' sort only against registered functions;
// these two are what V8 picked for our string columns.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});

export type AdminColumnDef<T extends RowData> = ColumnDef<typeof features, T, unknown>;

interface AdminDataTableProps<T extends RowData> {
  columns: AdminColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyState?: React.ReactNode;
  enableSorting?: boolean;
  onRowClick?: (_row: T) => void;
}

export function AdminDataTable<T extends RowData>({
  columns,
  data,
  loading,
  emptyState = 'No data available',
  enableSorting = false,
  onRowClick,
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

  return (
    <div className='border-border overflow-hidden rounded-xl border'>
      <Table>
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
          {loading &&
            Array.from({ length: 5 }, (_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {columns.map((_, j) => (
                  <TableCell key={`skeleton-cell-${j}`} className='px-4 py-2'>
                    <Skeleton className='h-4 w-3/4' />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!loading && table.getRowModel().rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length || 1} className='px-4 py-8 text-center'>
                <div className='text-muted-foreground/70 flex flex-col items-center gap-2'>
                  {emptyState}
                </div>
              </TableCell>
            </TableRow>
          )}

          {!loading &&
            table.getRowModel().rows.map(row => (
              <TableRow
                key={row.id}
                className={onRowClick ? 'cursor-pointer' : ''}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getAllCells().map(cell => (
                  <TableCell key={cell.id} className='text-foreground px-4 py-2 text-sm'>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
