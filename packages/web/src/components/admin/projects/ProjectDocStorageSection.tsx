import { DatabaseIcon, RefreshCwIcon, LoaderIcon, AlertCircleIcon } from 'lucide-react';
import { AdminBox } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@corates/shared';
import { formatDateTime } from '@/lib/formatDate';
import type { ProjectDocStats } from './types';

interface ProjectDocStorageSectionProps {
  stats?: ProjectDocStats;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRefresh: () => void;
}

export function ProjectDocStorageSection({
  stats,
  isLoading,
  isError,
  isFetching,
  onRefresh,
}: ProjectDocStorageSectionProps) {
  return (
    <AdminBox className='mb-6'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-foreground flex items-center text-lg font-semibold'>
          <DatabaseIcon className='text-muted-foreground/70 mr-2 size-5' />
          Y.Doc Storage
        </h2>
        <Button
          variant='ghost'
          size='sm'
          onClick={onRefresh}
          disabled={isFetching}
          title='Refresh stats (wakes the DO if hibernating)'
        >
          <RefreshCwIcon className={isFetching ? 'animate-spin' : ''} data-icon='inline-start' />
          Refresh
        </Button>
      </div>

      {isLoading ?
        <div className='text-muted-foreground flex items-center text-sm'>
          <LoaderIcon className='mr-2 size-4 animate-spin' />
          Loading storage stats...
        </div>
      : isError ?
        <div className='text-destructive flex items-center text-sm'>
          <AlertCircleIcon className='mr-2 size-4' />
          Failed to load storage stats. The DO may be unreachable.
        </div>
      : stats ?
        <div className='space-y-6'>
          {/* Headline: encoded size + memory usage */}
          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <div className='bg-muted/40 rounded-md p-4'>
              <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                Encoded Snapshot
              </dt>
              <dd className='text-foreground mt-1 text-2xl font-semibold'>
                {formatFileSize(stats.encodedSnapshotBytes)}
              </dd>
              <dd className='text-muted-foreground mt-1 text-xs'>
                Live `Y.encodeStateAsUpdate(doc)` size
              </dd>
            </div>
            <div className='bg-muted/40 rounded-md p-4'>
              <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                Memory Usage
              </dt>
              <dd
                className={`mt-1 text-2xl font-semibold ${
                  stats.memoryUsagePercent > 50 ? 'text-destructive'
                  : stats.memoryUsagePercent > 20 ? 'text-warning'
                  : 'text-foreground'
                }`}
              >
                {stats.memoryUsagePercent < 0.01 ?
                  '< 0.01%'
                : `${stats.memoryUsagePercent.toFixed(2)}%`}
              </dd>
              <dd className='text-muted-foreground mt-1 text-xs'>of 128 MB DO isolate limit</dd>
            </div>
            <div className='bg-muted/40 rounded-md p-4'>
              <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                On-Disk Total
              </dt>
              <dd className='text-foreground mt-1 text-2xl font-semibold'>
                {formatFileSize(stats.rows.totalBytes)}
              </dd>
              <dd className='text-muted-foreground mt-1 text-xs'>
                {stats.rows.total} row{stats.rows.total === 1 ? '' : 's'} in yjs_updates
              </dd>
            </div>
          </div>

          {/* Row breakdown by kind */}
          <div>
            <h3 className='text-foreground mb-2 text-sm font-medium'>Row Breakdown</h3>
            <dl className='grid grid-cols-2 gap-4 md:grid-cols-4'>
              <div>
                <dt className='text-muted-foreground text-xs'>Snapshot Rows</dt>
                <dd className='text-foreground mt-1 text-sm font-medium'>
                  {stats.rows.snapshot} ({formatFileSize(stats.rows.snapshotBytes)})
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-xs'>Update Rows</dt>
                <dd className='text-foreground mt-1 text-sm font-medium'>
                  {stats.rows.update} ({formatFileSize(stats.rows.updateBytes)})
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-xs'>Oldest Row</dt>
                <dd className='text-foreground mt-1 text-sm font-medium'>
                  {stats.timestamps.oldestRowAt ?
                    formatDateTime(new Date(stats.timestamps.oldestRowAt))
                  : '-'}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-xs'>Newest Row</dt>
                <dd className='text-foreground mt-1 text-sm font-medium'>
                  {stats.timestamps.newestRowAt ?
                    formatDateTime(new Date(stats.timestamps.newestRowAt))
                  : '-'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Logical content counts */}
          <div>
            <h3 className='text-foreground mb-2 text-sm font-medium'>Logical Content</h3>
            <dl className='grid grid-cols-2 gap-4 md:grid-cols-4'>
              <div>
                <dt className='text-muted-foreground text-xs'>Members</dt>
                <dd className='text-foreground mt-1 text-sm font-medium'>
                  {stats.content.members}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-xs'>Studies</dt>
                <dd className='text-foreground mt-1 text-sm font-medium'>
                  {stats.content.studies}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-xs'>Checklists</dt>
                <dd className='text-foreground mt-1 text-sm font-medium'>
                  {stats.content.checklists}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-xs'>PDFs</dt>
                <dd className='text-foreground mt-1 text-sm font-medium'>{stats.content.pdfs}</dd>
              </div>
            </dl>
          </div>
        </div>
      : null}
    </AdminBox>
  );
}
