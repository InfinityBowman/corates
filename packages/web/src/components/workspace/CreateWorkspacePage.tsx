/**
 * CreateWorkspacePage - a new workspace, owned by the user, from the switcher.
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsField } from '@/components/settings/primitives';
import { useWorkspaceDraft } from '@/hooks/useWorkspaceDraft';
import { queryKeys } from '@/lib/queryKeys';
import { showToast } from '@/lib/toast';
import { createWorkspace } from '@/server/functions/workspaces.functions';
import { WorkspaceUrlField } from './WorkspaceUrlField';

export function CreateWorkspacePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = useWorkspaceDraft();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.ready) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const created = await createWorkspace({
        data: { name: draft.name.trim(), slug: draft.slug },
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list });
      showToast.success('Workspace created', `${created.name} is ready for its first project.`);
      navigate({ to: '/dashboard', replace: true });
    } catch (err: unknown) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { setError, showToast: false });
      setIsSubmitting(false);
    }
  }

  return (
    <div className='flex min-h-[70vh] items-center justify-center p-6'>
      <div className='border-border bg-card w-full max-w-md rounded-xl border p-8 shadow-xs'>
        <h1 className='text-foreground text-xl font-semibold tracking-tight'>Create a workspace</h1>
        <p className='text-muted-foreground mt-1.5 text-sm'>
          A workspace holds projects and the people you appraise with, and has its own plan. Most
          teams name it after their lab, department, or review group.
        </p>

        <form onSubmit={handleSubmit} className='mt-6 flex flex-col gap-5'>
          {error && <Alert variant='destructive'>{error}</Alert>}

          <SettingsField label='Workspace name'>
            {id => (
              <Input
                id={id}
                value={draft.name}
                onChange={e => draft.setName(e.target.value)}
                placeholder='Evidence Synthesis Lab'
                maxLength={80}
                disabled={isSubmitting}
                autoFocus
              />
            )}
          </SettingsField>

          <SettingsField label='Workspace URL'>
            {id => (
              <WorkspaceUrlField
                id={id}
                value={draft.slugInput}
                onChange={draft.setSlug}
                status={draft.status}
                disabled={isSubmitting}
              />
            )}
          </SettingsField>

          <Button type='submit' disabled={isSubmitting || !draft.ready} className='w-full'>
            {isSubmitting ? 'Creating...' : 'Create workspace'}
          </Button>
        </form>
      </div>
    </div>
  );
}
