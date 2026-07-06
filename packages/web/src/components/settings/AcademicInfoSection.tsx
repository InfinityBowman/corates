/**
 * AcademicInfoSection - Title, institution, and department fields
 */

import { useState, useMemo, useCallback, useId } from 'react';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { showToast } from '@/components/ui/toast';
import { TITLE_OPTIONS } from '@/components/auth/RoleSelector';
import { syncProfileToProjects } from '@/lib/syncUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const fieldId = useId();

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
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Update Failed' });
    } finally {
      setSaving(false);
    }
  }, [editTitle, editInstitution, editDepartment, updateProfile]);

  return (
    <>
      <Separator />
      <div className='mt-4 flex items-start justify-between'>
        <div className='flex-1'>
          <span className='text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase'>
            Academic Information
          </span>
          {isEditing ?
            <div className='mt-3 flex flex-col gap-4'>
              <div>
                <Label htmlFor={`${fieldId}-title`} className='mb-1.5'>
                  Title
                </Label>
                <Select value={editTitleSelection} onValueChange={setEditTitleSelection}>
                  <SelectTrigger id={`${fieldId}-title`} className='max-w-xs'>
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
                  <Input
                    type='text'
                    value={editCustomTitle}
                    onChange={e => setEditCustomTitle(e.target.value)}
                    className='mt-2 max-w-xs'
                    placeholder='Enter your title'
                    maxLength={50}
                    aria-label='Custom title'
                  />
                )}
              </div>
              <div>
                <Label htmlFor={`${fieldId}-institution`} className='mb-1.5'>
                  Institution
                </Label>
                <Input
                  id={`${fieldId}-institution`}
                  type='text'
                  value={editInstitution}
                  onChange={e => setEditInstitution(e.target.value)}
                  className='max-w-md'
                  placeholder='University or organization'
                  maxLength={200}
                />
              </div>
              <div>
                <Label htmlFor={`${fieldId}-department`} className='mb-1.5'>
                  Department
                </Label>
                <Input
                  id={`${fieldId}-department`}
                  type='text'
                  value={editDepartment}
                  onChange={e => setEditDepartment(e.target.value)}
                  className='max-w-md'
                  placeholder='Department or faculty'
                  maxLength={200}
                />
              </div>
              <div className='flex gap-2 pt-1'>
                <Button onClick={saveAcademic} disabled={saving}>
                  Save
                </Button>
                <Button variant='secondary' onClick={cancelEditing} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          : <div className='mt-1 flex flex-col gap-1.5'>
              <div className='flex items-baseline gap-2'>
                <span className='text-muted-foreground text-xs font-medium'>Title:</span>
                <span className='text-foreground text-sm'>
                  {(user?.title as string) || (
                    <span className='text-muted-foreground'>Not set</span>
                  )}
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
          <Button variant='link' onClick={startEditing}>
            Edit
          </Button>
        )}
      </div>
    </>
  );
}
