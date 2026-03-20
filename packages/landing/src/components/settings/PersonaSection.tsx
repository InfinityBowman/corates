/**
 * PersonaSection - Persona/role selection for user profile
 */

import { useState, useCallback } from 'react';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { showToast } from '@/components/ui/toast';
import { ROLES, getRoleLabel } from '@/components/auth/RoleSelector';
import { syncProfileToProjects } from '@/lib/syncUtils';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function PersonaSection() {
  const user = useAuthStore(selectUser);
  const updateProfile = useAuthStore(s => s.updateProfile);

  const [isEditing, setIsEditing] = useState(false);
  const [editSelection, setEditSelection] = useState('');
  const [saving, setSaving] = useState(false);

  const startEditing = useCallback(() => {
    setEditSelection((user?.persona as string) || '');
    setIsEditing(true);
  }, [user?.persona]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditSelection('');
  }, []);

  const saveRole = useCallback(async () => {
    setSaving(true);
    try {
      await updateProfile({ persona: editSelection || null });
      syncProfileToProjects();
      showToast.success('Profile Updated', 'Your persona has been updated successfully.');
      setIsEditing(false);
    } catch {
      showToast.error('Update Failed', 'Failed to update persona. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [editSelection, updateProfile]);

  return (
    <>
    <Separator />
    <div className='flex items-start justify-between my-4'>
      <div className='flex-1'>
        <label className='text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase'>
          Persona
        </label>
        {isEditing ?
          <div className='mt-3 flex flex-col gap-4'>
            <Select value={editSelection} onValueChange={setEditSelection}>
              <SelectTrigger className='max-w-xs'>
                <SelectValue placeholder='Select a persona' />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className='flex gap-2 pt-1'>
              <button
                onClick={saveRole}
                disabled={saving}
                className='bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow disabled:opacity-50'
              >
                Save
              </button>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className='bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50'
              >
                Cancel
              </button>
            </div>
          </div>
        : <div className='mt-1'>
            <span className='text-foreground text-sm'>
              {user?.persona ?
                getRoleLabel(user.persona as string)
              : <span className='text-muted-foreground'>Not set</span>}
            </span>
          </div>
        }
      </div>
      {!isEditing && (
        <button
          onClick={startEditing}
          className='text-primary hover:text-primary/80 text-sm font-medium transition-colors'
        >
          Edit
        </button>
      )}
    </div>
    </>
  );
}
