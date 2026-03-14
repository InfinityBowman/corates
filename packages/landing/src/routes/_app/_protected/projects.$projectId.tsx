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
  const {
    connected,
    connecting,
    synced,
    error,
    studies,
    meta,
    members,
  } = useProject(projectId);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-destructive">Connection Error</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (connecting && !synced) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" label="Connecting to project..." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Connection status */}
      <div className="mb-6 flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <span className="text-sm text-muted-foreground">
          {connected ? 'Connected' : 'Connecting...'}{synced ? ' (synced)' : ''}
        </span>
      </div>

      {/* Project info */}
      <h1 className="mb-4 text-2xl font-bold text-foreground">
        {(meta as Record<string, unknown>)?.name as string || 'Project'}
      </h1>

      {/* Members */}
      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Members ({(members as unknown[]).length})
        </h2>
      </div>

      {/* Studies */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Studies ({(studies as unknown[]).length})
        </h2>
        <div className="space-y-2">
          {(studies as Array<Record<string, unknown>>).map((study) => (
            <div key={study.id as string} className="rounded-lg border border-border bg-card p-4">
              <p className="font-medium text-foreground">{study.name as string || 'Untitled Study'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {((study.checklists as unknown[]) || []).length} checklists
                {' '}{((study.pdfs as unknown[]) || []).length} PDFs
              </p>
            </div>
          ))}
          {(studies as unknown[]).length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No studies yet</p>
          )}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
