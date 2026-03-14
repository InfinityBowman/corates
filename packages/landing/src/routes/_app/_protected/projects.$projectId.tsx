/**
 * Project layout route - establishes Y.js connection for a project
 *
 * This is a minimal integration test route for the Yjs migration.
 * It mounts useProject, displays connection state and study list.
 * Will be expanded with full project UI in Phase 4.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useProject } from '@/primitives/useProject';
import { Spinner } from '@/components/ui/spinner';

export const Route = createFileRoute('/_app/_protected/projects/$projectId')({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const { connected, connecting, synced, error, studies, meta, members } = useProject(projectId);

  if (error) {
    return (
      <div className='mx-auto max-w-2xl px-4 py-8'>
        <div className='border-destructive/20 bg-destructive/5 rounded-lg border p-6 text-center'>
          <h2 className='text-destructive mb-2 text-lg font-semibold'>Connection Error</h2>
          <p className='text-muted-foreground text-sm'>{error}</p>
        </div>
      </div>
    );
  }

  if (connecting && !synced) {
    return (
      <div className='flex min-h-[50vh] items-center justify-center'>
        <Spinner size='lg' label='Connecting to project...' />
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      {/* Connection status */}
      <div className='mb-6 flex items-center gap-3'>
        <div
          className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'}`}
        />
        <span className='text-muted-foreground text-sm'>
          {connected ? 'Connected' : 'Connecting...'}
          {synced ? ' (synced)' : ''}
        </span>
      </div>

      {/* Project info */}
      <h1 className='text-foreground mb-4 text-2xl font-bold'>
        {((meta as Record<string, unknown>)?.name as string) || 'Project'}
      </h1>

      {/* Members */}
      <div className='mb-6'>
        <h2 className='text-muted-foreground mb-2 text-sm font-semibold'>
          Members ({(members as unknown[]).length})
        </h2>
      </div>

      {/* Studies */}
      <div className='mb-6'>
        <h2 className='text-muted-foreground mb-3 text-sm font-semibold'>
          Studies ({(studies as unknown[]).length})
        </h2>
        <div className='space-y-2'>
          {(studies as Array<Record<string, unknown>>).map(study => (
            <div key={study.id as string} className='border-border bg-card rounded-lg border p-4'>
              <p className='text-foreground font-medium'>
                {(study.name as string) || 'Untitled Study'}
              </p>
              <p className='text-muted-foreground mt-1 text-xs'>
                {((study.checklists as unknown[]) || []).length} checklists{' '}
                {((study.pdfs as unknown[]) || []).length} PDFs
              </p>
            </div>
          ))}
          {(studies as unknown[]).length === 0 && (
            <p className='text-muted-foreground py-4 text-center text-sm'>No studies yet</p>
          )}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
