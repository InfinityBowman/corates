/**
 * PersonaSection - Persona/role selection for user profile
 */

import { createSignal, Show, For } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { showToast } from '@/components/ui/toast';
import { ROLES, getRoleLabel } from '@/components/auth/RoleSelector.jsx';
import { apiFetch } from '@lib/apiFetch.js';
import {
  Select,
  SelectControl,
  SelectTrigger,
  SelectValueText,
  SelectIndicator,
  SelectPositioner,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
  createListCollection,
} from '@/components/ui/select';

/**
 * Sync profile changes to all projects the user is a member of
 */
async function syncProfileToProjects() {
  await apiFetch('/api/users/sync-profile', { method: 'POST' });
}

const personaCollection = createListCollection({
  items: ROLES,
  itemToString: item => item.label,
  itemToValue: item => item.id,
});

export default function PersonaSection() {
  const auth = useBetterAuth();
  const user = () => auth.user();

  const [isEditingRole, setIsEditingRole] = createSignal(false);
  const [editRoleSelection, setEditRoleSelection] = createSignal([]);
  const [saving, setSaving] = createSignal(false);

  const startEditingRole = () => {
    const currentPersona = user()?.persona || '';
    setEditRoleSelection(currentPersona ? [currentPersona] : []);
    setIsEditingRole(true);
  };

  const cancelEditingRole = () => {
    setIsEditingRole(false);
    setEditRoleSelection([]);
  };

  const saveRole = async () => {
    setSaving(true);
    try {
      const selectedPersona = editRoleSelection()[0] || null;
      await auth.updateProfile({ persona: selectedPersona });
      syncProfileToProjects();
      showToast.success('Profile Updated', 'Your persona has been updated successfully.');
      setIsEditingRole(false);
    } catch (err) {
      console.warn('Failed to update profile persona:', err.message);
      showToast.error('Update Failed', 'Failed to update persona. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class='border-border-subtle flex items-start justify-between border-t py-4'>
      <div class='flex-1'>
        <label class='text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase'>
          Persona
        </label>
        <Show
          when={isEditingRole()}
          fallback={
            <div class='mt-1'>
              <span class='text-foreground text-sm'>
                {user()?.persona ?
                  getRoleLabel(user()?.persona)
                : <span class='text-muted-foreground'>Not set</span>}
              </span>
            </div>
          }
        >
          <div class='mt-3 space-y-4'>
            <Select
              collection={personaCollection}
              value={editRoleSelection()}
              onValueChange={details => setEditRoleSelection(details.value)}
              class='max-w-xs'
            >
              <SelectControl>
                <SelectTrigger>
                  <SelectValueText placeholder='Select a persona' />
                  <SelectIndicator />
                </SelectTrigger>
              </SelectControl>
              <SelectPositioner>
                <SelectContent>
                  <For each={ROLES}>
                    {role => (
                      <SelectItem item={role}>
                        <SelectItemText>{role.label}</SelectItemText>
                        <SelectItemIndicator />
                      </SelectItem>
                    )}
                  </For>
                </SelectContent>
              </SelectPositioner>
            </Select>
            <div class='flex gap-2 pt-1'>
              <button
                onClick={saveRole}
                disabled={saving()}
                class='bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow disabled:opacity-50'
              >
                Save
              </button>
              <button
                onClick={cancelEditingRole}
                disabled={saving()}
                class='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50'
              >
                Cancel
              </button>
            </div>
          </div>
        </Show>
      </div>
      <Show when={!isEditingRole()}>
        <button
          onClick={startEditingRole}
          class='text-primary hover:text-primary/80 text-sm font-medium transition-colors'
        >
          Edit
        </button>
      </Show>
    </div>
  );
}
