/**
 * Workspace settings > General: the workspace name and its URL. Owner only.
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { SettingsIcon, TriangleAlertIcon } from 'lucide-react';
import { WORKSPACE_SLUG_MAX } from '@corates/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsPage, SettingsSection, SettingsField } from '@/components/settings/primitives';
import { useCurrentWorkspace, type Workspace } from '@/hooks/useWorkspaces';
import { useSlugAvailability } from '@/hooks/useSlugAvailability';
import { queryKeys } from '@/lib/queryKeys';
import { showToast } from '@/lib/toast';
import { workspaceSettingsPath } from '@/lib/workspacePaths';
import { updateWorkspace } from '@/server/functions/workspaces.functions';
import { OwnerOnlyNotice } from './OwnerOnlyNotice';
import { WorkspaceUrlField } from './WorkspaceUrlField';

export function WorkspaceGeneralSettings() {
  const { workspace } = useCurrentWorkspace();
  if (!workspace) return null;
  if (workspace.role !== 'owner') return <OwnerOnlyNotice title='General' />;
  // Keyed so the form resets when the user switches workspaces.
  return <GeneralForm key={workspace.id} workspace={workspace} />;
}

function GeneralForm({ workspace }: { workspace: Workspace }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState(workspace.name);
  const [slugInput, setSlugInput] = useState(workspace.slug);
  const [saving, setSaving] = useState(false);
  const { slug, status } = useSlugAvailability(slugInput, {
    orgId: workspace.id,
    current: workspace.slug,
  });

  const trimmedName = name.trim();
  const nameChanged = trimmedName !== workspace.name;
  const slugChanged = slug !== workspace.slug;
  const slugReady = status.state === 'unchanged' || status.state === 'available';
  const canSave = !saving && trimmedName.length > 0 && (nameChanged || slugChanged) && slugReady;

  async function handleSave() {
    setSaving(true);
    try {
      await updateWorkspace({
        data: {
          orgId: workspace.id,
          ...(nameChanged && { name: trimmedName }),
          ...(slugChanged && { slug }),
        },
      });
      // Write the new slug into the cache before navigating, or the layout would
      // briefly find neither the old URL nor the new one.
      queryClient.setQueryData<Workspace[]>(queryKeys.workspaces.list, list =>
        list?.map(w => (w.id === workspace.id ? { ...w, name: trimmedName, slug } : w)),
      );
      if (slugChanged) {
        navigate({ to: workspaceSettingsPath(slug, 'general') as string, replace: true });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list });
      showToast.success('Workspace updated', 'Your changes have been saved.');
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not save the workspace' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPage title='General' description='How this workspace is named and where it lives.'>
      <SettingsSection
        title='Workspace'
        icon={SettingsIcon}
        footer={
          <>
            <span className='text-muted-foreground text-xs'>
              Only you, the owner, can change these.
            </span>
            <Button size='sm' onClick={handleSave} disabled={!canSave}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className='grid gap-5 px-5 py-5 lg:grid-cols-2'>
          <SettingsField
            label='Workspace name'
            hint='Shown in the workspace menu and to your team.'
          >
            {id => (
              <Input
                id={id}
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={80}
                placeholder='Workspace name'
              />
            )}
          </SettingsField>

          <SettingsField
            label='Workspace URL'
            hint={`Lowercase letters, numbers, and hyphens, up to ${WORKSPACE_SLUG_MAX} characters.`}
          >
            {id => (
              <WorkspaceUrlField
                id={id}
                value={slugInput}
                onChange={setSlugInput}
                status={status}
              />
            )}
          </SettingsField>
        </div>

        {slugChanged && slugReady && (
          <div className='px-5 pb-5'>
            <Alert variant='warning'>
              <TriangleAlertIcon />
              <AlertDescription>
                Links to this workspace&apos;s home and settings will stop working. Links to
                projects keep working and open at the new URL.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
