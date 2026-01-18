/**
 * AcademicInfoSection - Title, institution, and department fields
 */

import { createSignal, createMemo, Show, For } from 'solid-js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { showToast } from '@/components/ui/toast';
import { TITLE_OPTIONS } from '@/components/auth/RoleSelector.jsx';
import { apiFetch } from '@lib/apiFetch.js';

/**
 * Sync profile changes to all projects the user is a member of
 */
async function syncProfileToProjects() {
  await apiFetch('/api/users/sync-profile', { method: 'POST' });
}
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

const titleCollection = createListCollection({
  items: TITLE_OPTIONS,
  itemToString: item => item.label,
  itemToValue: item => item.value,
});

export default function AcademicInfoSection() {
  const auth = useBetterAuth();
  const user = () => auth.user();

  const [isEditingAcademic, setIsEditingAcademic] = createSignal(false);
  const [editTitleSelection, setEditTitleSelection] = createSignal([]);
  const [editCustomTitle, setEditCustomTitle] = createSignal('');
  const [editInstitution, setEditInstitution] = createSignal('');
  const [editDepartment, setEditDepartment] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  const editTitle = createMemo(() => {
    const selected = editTitleSelection()[0];
    if (selected === 'other') {
      return editCustomTitle().trim();
    }
    return selected || '';
  });

  const isEditingCustomTitle = createMemo(() => editTitleSelection()[0] === 'other');

  const startEditingAcademic = () => {
    const currentTitle = user()?.title || '';
    const isStandardTitle = TITLE_OPTIONS.some(
      opt => opt.value === currentTitle && opt.value !== 'other',
    );
    if (currentTitle && !isStandardTitle) {
      setEditTitleSelection(['other']);
      setEditCustomTitle(currentTitle);
    } else {
      setEditTitleSelection(currentTitle ? [currentTitle] : []);
      setEditCustomTitle('');
    }
    setEditInstitution(user()?.institution || '');
    setEditDepartment(user()?.department || '');
    setIsEditingAcademic(true);
  };

  const cancelEditingAcademic = () => {
    setIsEditingAcademic(false);
    setEditTitleSelection([]);
    setEditCustomTitle('');
    setEditInstitution('');
    setEditDepartment('');
  };

  const saveAcademic = async () => {
    setSaving(true);
    try {
      await auth.updateProfile({
        title: editTitle() || null,
        institution: editInstitution()?.trim() || null,
        department: editDepartment()?.trim() || null,
      });
      syncProfileToProjects();
      showToast.success('Profile Updated', 'Your academic information has been updated.');
      setIsEditingAcademic(false);
    } catch (err) {
      console.warn('Failed to update academic info:', err.message);
      showToast.error('Update Failed', 'Failed to update academic information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class='flex items-start justify-between border-t border-slate-100 pt-5'>
      <div class='flex-1'>
        <label class='mb-1 block text-xs font-medium tracking-wide text-slate-400 uppercase'>
          Academic Information
        </label>
        <Show
          when={isEditingAcademic()}
          fallback={
            <div class='mt-2 space-y-2'>
              <div class='flex items-baseline gap-2'>
                <span class='text-xs font-medium text-slate-500'>Title:</span>
                <span class='text-slate-900'>
                  {user()?.title || <span class='text-slate-400'>Not set</span>}
                </span>
              </div>
              <div class='flex items-baseline gap-2'>
                <span class='text-xs font-medium text-slate-500'>Institution:</span>
                <span class='text-slate-900'>
                  {user()?.institution || <span class='text-slate-400'>Not set</span>}
                </span>
              </div>
              <div class='flex items-baseline gap-2'>
                <span class='text-xs font-medium text-slate-500'>Department:</span>
                <span class='text-slate-900'>
                  {user()?.department || <span class='text-slate-400'>Not set</span>}
                </span>
              </div>
            </div>
          }
        >
          <div class='mt-3 space-y-4'>
            <div>
              <label class='mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase'>
                Title
              </label>
              <Select
                collection={titleCollection}
                value={editTitleSelection()}
                onValueChange={details => setEditTitleSelection(details.value)}
                class='max-w-xs'
              >
                <SelectControl>
                  <SelectTrigger>
                    <SelectValueText placeholder='Select a title (optional)' />
                    <SelectIndicator />
                  </SelectTrigger>
                </SelectControl>
                <SelectPositioner>
                  <SelectContent>
                    <For each={TITLE_OPTIONS}>
                      {option => (
                        <SelectItem item={option}>
                          <SelectItemText>{option.label}</SelectItemText>
                          <SelectItemIndicator />
                        </SelectItem>
                      )}
                    </For>
                  </SelectContent>
                </SelectPositioner>
              </Select>
              <Show when={isEditingCustomTitle()}>
                <input
                  type='text'
                  value={editCustomTitle()}
                  onInput={e => setEditCustomTitle(e.target.value)}
                  class='mt-2 block w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none'
                  placeholder='Enter your title'
                  maxLength={50}
                />
              </Show>
            </div>
            <div>
              <label class='mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase'>
                Institution
              </label>
              <input
                type='text'
                value={editInstitution()}
                onInput={e => setEditInstitution(e.target.value)}
                class='block w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none'
                placeholder='University or organization'
                maxLength={200}
              />
            </div>
            <div>
              <label class='mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase'>
                Department
              </label>
              <input
                type='text'
                value={editDepartment()}
                onInput={e => setEditDepartment(e.target.value)}
                class='block w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none'
                placeholder='Department or faculty'
                maxLength={200}
              />
            </div>
            <div class='flex gap-2 pt-1'>
              <button
                onClick={saveAcademic}
                disabled={saving()}
                class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow disabled:opacity-50'
              >
                Save
              </button>
              <button
                onClick={cancelEditingAcademic}
                disabled={saving()}
                class='rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50'
              >
                Cancel
              </button>
            </div>
          </div>
        </Show>
      </div>
      <Show when={!isEditingAcademic()}>
        <button
          onClick={startEditingAcademic}
          class='text-sm font-medium text-blue-600 transition-colors hover:text-blue-700'
        >
          Edit
        </button>
      </Show>
    </div>
  );
}
