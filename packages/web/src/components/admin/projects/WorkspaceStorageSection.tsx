import { DatabaseIcon, RefreshCwIcon, AlertCircleIcon } from 'lucide-react';
import { AdminBox } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatFileSize } from '@corates/shared';
import type { WorkspaceStats } from './types';

interface WorkspaceStorageSectionProps {
  stats?: WorkspaceStats;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRefresh: () => void;
}

export function WorkspaceStorageSection({
  stats,
  isLoading,
  isError,
  isFetching,
  onRefresh,
}: WorkspaceStorageSectionProps) {
  return (
    <AdminBox className='mb-6'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-foreground flex items-center text-lg font-semibold'>
          <DatabaseIcon className='text-muted-foreground/70 mr-2 size-5' />
          Workspace Storage
        </h2>
        <Button
          variant='ghost'
          size='sm'
          onClick={onRefresh}
          disabled={isFetching}
          title='Refresh stats (wakes the workspace if hibernating)'
        >
          <RefreshCwIcon className={isFetching ? 'animate-spin' : ''} data-icon='inline-start' />
          Refresh
        </Button>
      </div>

      {isLoading ?
        <div className='text-muted-foreground flex items-center text-sm'>
          <Spinner size='sm' variant='current' className='mr-2' />
          Loading workspace stats...
        </div>
      : isError ?
        <div className='text-destructive flex items-center text-sm'>
          <AlertCircleIcon className='mr-2 size-4' />
          Failed to load workspace stats. The workspace may be unreachable.
        </div>
      : stats ?
        <div className='space-y-6'>
          {/* Headline: database size + live rows + connections */}
          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <div className='bg-muted/40 rounded-md p-4'>
              <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                Database Size
              </dt>
              <dd className='text-foreground mt-1 text-2xl font-semibold'>
                {formatFileSize(stats.databaseSizeBytes)}
              </dd>
              <dd className='text-muted-foreground mt-1 text-xs'>Workspace DO SQLite</dd>
            </div>
            <div className='bg-muted/40 rounded-md p-4'>
              <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                Live Rows
              </dt>
              <dd className='text-foreground mt-1 text-2xl font-semibold'>{stats.rows.live}</dd>
              <dd className='text-muted-foreground mt-1 text-xs'>
                {stats.rows.tombstones} tombstone{stats.rows.tombstones === 1 ? '' : 's'}
              </dd>
            </div>
            <div className='bg-muted/40 rounded-md p-4'>
              <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                Connections
              </dt>
              <dd className='text-foreground mt-1 text-2xl font-semibold'>
                {stats.connections.ready}
              </dd>
              <dd className='text-muted-foreground mt-1 text-xs'>
                {stats.connections.total} socket{stats.connections.total === 1 ? '' : 's'},{' '}
                {stats.connections.presence} with presence
              </dd>
            </div>
          </div>

          {/* Engine internals */}
          <div>
            <h3 className='text-foreground mb-2 text-sm font-medium'>Engine</h3>
            <dl className='grid grid-cols-2 gap-4 md:grid-cols-4'>
              <div>
                <dt className='text-muted-foreground text-xs'>Schema Version</dt>
                <dd className='text-foreground mt-1 text-sm font-medium'>
                  {stats.currentVersion} (app {stats.schemaVersion})
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-xs'>Mutation Log</dt>
                <dd className='text-foreground mt-1 text-sm font-medium'>
                  {stats.mutationLogEntries} entr{stats.mutationLogEntries === 1 ? 'y' : 'ies'}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-xs'>Known Clients</dt>
                <dd className='text-foreground mt-1 text-sm font-medium'>{stats.knownClients}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-xs'>Backend Id</dt>
                <dd
                  className='text-foreground mt-1 truncate text-sm font-medium'
                  title={stats.backendId}
                >
                  {stats.backendId || '-'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Yjs fields (reconciliation collaborative text) */}
          {stats.extension && (
            <div>
              <h3 className='text-foreground mb-2 text-sm font-medium'>Yjs Fields</h3>
              <dl className='grid grid-cols-2 gap-4 md:grid-cols-4'>
                <div>
                  <dt className='text-muted-foreground text-xs'>Fields</dt>
                  <dd className='text-foreground mt-1 text-sm font-medium'>
                    {stats.extension.fields}
                    {stats.extension.frozenFields > 0 && (
                      <span className='text-destructive ml-1'>
                        ({stats.extension.frozenFields} frozen)
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground text-xs'>Field Bytes</dt>
                  <dd className='text-foreground mt-1 text-sm font-medium'>
                    {formatFileSize(stats.extension.fieldBytes)}
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground text-xs'>Pending Updates</dt>
                  <dd className='text-foreground mt-1 text-sm font-medium'>
                    {stats.extension.pendingUpdates}
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground text-xs'>Cached Docs</dt>
                  <dd className='text-foreground mt-1 text-sm font-medium'>
                    {stats.extension.cachedDocs}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      : null}
    </AdminBox>
  );
}
