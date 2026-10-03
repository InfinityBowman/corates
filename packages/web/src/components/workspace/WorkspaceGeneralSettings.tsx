/**
 * Workspace settings > General: the name of the workspace the user owns.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsPage, SettingsSection, SettingsField } from '@/components/settings/primitives';
import { useOwnedWorkspace, type Workspace } from '@/hooks/useWorkspaces';
import { queryKeys } from '@/lib/queryKeys';
import { showToast } from '@/lib/toast';
import { updateWorkspace } from '@/server/functions/workspaces.functions';

export function WorkspaceGeneralSettings() {
  const { workspace } = useOwnedWorkspace();
  if (!workspace) return null;
  return <GeneralForm key={workspace.id} workspace={workspace} />;
}

function GeneralForm({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);

  const trimmedName = name.trim();
  const canSave = !saving && trimmedName.length > 0 && trimmedName !== workspace.name;

  async function handleSave() {
    setSaving(true);
    try {
      await updateWorkspace({ data: { orgId: workspace.id, name: trimmedName } });
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
    <SettingsPage title='General' description='How your workspace is named.'>
      <SettingsSection
        title='Workspace'
        icon={SettingsIcon}
        footer={
          <>
            <span className='text-muted-foreground text-xs'>
              Only you, the owner, can change this.
            </span>
            <Button size='sm' onClick={handleSave} disabled={!canSave}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className='grid gap-5 px-5 py-5 lg:grid-cols-2'>
          <SettingsField label='Workspace name' hint='Shown to your team.'>
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
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
