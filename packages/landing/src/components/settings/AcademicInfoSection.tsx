/**
 * AcademicInfoSection - Title, institution, and department fields
 */

import { useState, useMemo, useCallback } from 'react';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { showToast } from '@/components/ui/toast';
import { TITLE_OPTIONS } from '@/components/auth/RoleSelector';
import { syncProfileToProjects } from '@/lib/syncUtils';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function AcademicInfoSection() {
  const user = useAuthStore(selectUser);
  const updateProfile = useAuthStore(s => s.updateProfile);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitleSelection, setEditTitleSelection] = useState('');
  const [editCustomTitle, setEditCustomTitle] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [saving, setSaving] = useState(false);

  const editTitle = useMemo(() => {
    if (editTitleSelection === 'other') return editCustomTitle.trim();
    if (editTitleSelection === '_none') return '';
    return editTitleSelection;
  }, [editTitleSelection, editCustomTitle]);

  const isEditingCustomTitle = editTitleSelection === 'other';

  const startEditing = useCallback(() => {
    const currentTitle = (user?.title as string) || '';
    const isStandardTitle = TITLE_OPTIONS.some(
      opt => opt.value === currentTitle && opt.value !== 'other',
    );
    if (currentTitle && !isStandardTitle) {
      setEditTitleSelection('other');
      setEditCustomTitle(currentTitle);
    } else {
      setEditTitleSelection(currentTitle);
      setEditCustomTitle('');
    }
    setEditInstitution((user?.institution as string) || '');
    setEditDepartment((user?.department as string) || '');
    setIsEditing(true);
  }, [user?.title, user?.institution, user?.department]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditTitleSelection('');
    setEditCustomTitle('');
    setEditInstitution('');
    setEditDepartment('');
  }, []);

  const saveAcademic = useCallback(async () => {
    setSaving(true);
    try {
      await updateProfile({
        title: editTitle || null,
        institution: editInstitution?.trim() || null,
        department: editDepartment?.trim() || null,
      });
      syncProfileToProjects();
      showToast.success('Profile Updated', 'Your academic information has been updated.');
      setIsEditing(false);
    } catch {
      showToast.error('Update Failed', 'Failed to update academic information. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [editTitle, editInstitution, editDepartment, updateProfile]);

  return (
    <>
    <Separator />
    <div className='flex items-start justify-between mt-4'>
      <div className='flex-1'>
        <label className='text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase'>
          Academic Information
        </label>
        {isEditing ?
          <div className='mt-3 flex flex-col gap-4'>
            <div>
              <label className='text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase'>
                Title
              </label>
              <Select value={editTitleSelection} onValueChange={setEditTitleSelection}>
                <SelectTrigger className='max-w-xs'>
                  <SelectValue placeholder='Select a title (optional)' />
                </SelectTrigger>
                <SelectContent>
                  {TITLE_OPTIONS.map(option => (
                    <SelectItem key={option.value || '_none'} value={option.value || '_none'}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEditingCustomTitle && (
                <input
                  type='text'
                  value={editCustomTitle}
                  onChange={e => setEditCustomTitle(e.target.value)}
                  className='border-border bg-card focus:border-primary focus:ring-ring/20 mt-2 block w-full max-w-xs rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:ring-2 focus:outline-none'
                  placeholder='Enter your title'
                  maxLength={50}
                />
              )}
            </div>
            <div>
              <label className='text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase'>
                Institution
              </label>
              <input
                type='text'
                value={editInstitution}
                onChange={e => setEditInstitution(e.target.value)}
                className='border-border bg-card focus:border-primary focus:ring-ring/20 block w-full max-w-md rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:ring-2 focus:outline-none'
                placeholder='University or organization'
                maxLength={200}
              />
            </div>
            <div>
              <label className='text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase'>
                Department
              </label>
              <input
                type='text'
                value={editDepartment}
                onChange={e => setEditDepartment(e.target.value)}
                className='border-border bg-card focus:border-primary focus:ring-ring/20 block w-full max-w-md rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:ring-2 focus:outline-none'
                placeholder='Department or faculty'
                maxLength={200}
              />
            </div>
            <div className='flex gap-2 pt-1'>
              <button
                onClick={saveAcademic}
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
        : <div className='mt-1 flex flex-col gap-1.5'>
            <div className='flex items-baseline gap-2'>
              <span className='text-muted-foreground text-xs font-medium'>Title:</span>
              <span className='text-foreground text-sm'>
                {(user?.title as string) || <span className='text-muted-foreground'>Not set</span>}
              </span>
            </div>
            <div className='flex items-baseline gap-2'>
              <span className='text-muted-foreground text-xs font-medium'>Institution:</span>
              <span className='text-foreground text-sm'>
                {(user?.institution as string) || (
                  <span className='text-muted-foreground'>Not set</span>
                )}
              </span>
            </div>
            <div className='flex items-baseline gap-2'>
              <span className='text-muted-foreground text-xs font-medium'>Department:</span>
              <span className='text-foreground text-sm'>
                {(user?.department as string) || (
                  <span className='text-muted-foreground'>Not set</span>
                )}
              </span>
            </div>
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
