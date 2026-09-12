import { RefreshCwIcon } from 'lucide-react';
import { AdminPanel, AdminField, AdminFieldGrid, AdminStat } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@corates/shared';
import type { WorkspaceStats } from '@/server/functions/admin-projects.server';

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
    <AdminPanel
      title='Workspace Storage'
      padded
      action={
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
      }
    >
      {isError ?
        <p className='text-destructive text-[13px]'>
          Failed to load workspace stats. The workspace may be unreachable.
        </p>
      : <div className='flex flex-col gap-6'>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
            <AdminStat
              label='Database size'
              value={formatFileSize(stats?.databaseSizeBytes ?? 0)}
              hint='Workspace DO SQLite'
              loading={isLoading}
            />
            <AdminStat
              label='Live rows'
              value={stats?.rows.live ?? 0}
              hint={`${stats?.rows.tombstones ?? 0} tombstone${stats?.rows.tombstones === 1 ? '' : 's'}`}
              loading={isLoading}
            />
            <AdminStat
              label='Connections'
              value={stats?.connections.ready ?? 0}
              hint={`${stats?.connections.total ?? 0} sockets, ${stats?.connections.presence ?? 0} with presence`}
              loading={isLoading}
            />
          </div>

          {stats && (
            <>
              <div>
                <h3 className='text-foreground mb-3 text-[13px] font-medium'>Engine</h3>
                <AdminFieldGrid className='lg:grid-cols-4'>
                  <AdminField label='Schema version'>
                    {stats.currentVersion} (app {stats.schemaVersion})
                  </AdminField>
                  <AdminField label='Mutation log'>
                    {stats.mutationLogEntries} entr{stats.mutationLogEntries === 1 ? 'y' : 'ies'}
                  </AdminField>
                  <AdminField label='Known clients'>{stats.knownClients}</AdminField>
                  <AdminField label='Backend id' mono>
                    <span className='truncate' title={stats.backendId}>
                      {stats.backendId || '-'}
                    </span>
                  </AdminField>
                </AdminFieldGrid>
              </div>

              {stats.extension && (
                <div>
                  <h3 className='text-foreground mb-3 text-[13px] font-medium'>Yjs fields</h3>
                  <AdminFieldGrid className='lg:grid-cols-4'>
                    <AdminField label='Fields'>
                      {stats.extension.fields}
                      {stats.extension.frozenFields > 0 && (
                        <span className='text-destructive'>
                          ({stats.extension.frozenFields} frozen)
                        </span>
                      )}
                    </AdminField>
                    <AdminField label='Field bytes'>
                      {formatFileSize(stats.extension.fieldBytes)}
                    </AdminField>
                    <AdminField label='Pending updates'>
                      {stats.extension.pendingUpdates}
                    </AdminField>
                    <AdminField label='Cached docs'>{stats.extension.cachedDocs}</AdminField>
                  </AdminFieldGrid>
                </div>
              )}
            </>
          )}
        </div>
      }
    </AdminPanel>
  );
}
