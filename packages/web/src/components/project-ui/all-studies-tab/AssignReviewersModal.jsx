/**
 * AssignReviewersModal - Modal for assigning reviewers to a study
 *
 * Fields:
 * - Reviewer 1 select
 * - Reviewer 2 select
 */

import { createSignal, createEffect, createMemo, Show } from 'solid-js';
import { Dialog, Select } from '@corates/ui';
import { BiRegularUser } from 'solid-icons/bi';
import projectStore from '@/stores/projectStore.js';

export default function AssignReviewersModal(props) {
  // props.open: boolean
  // props.onOpenChange: (open: boolean) => void
  // props.study: Study object
  // props.projectId: string
  // props.onSave: (studyId, updates) => Promise<void>

  const [reviewer1, setReviewer1] = createSignal('');
  const [reviewer2, setReviewer2] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  const members = () => projectStore.getMembers(props.projectId) || [];

  // Convert members to Select items format
  const memberItems = createMemo(() => {
    const getMemberName = member =>
      member?.displayName || member?.name || member?.email || 'Unknown';

    return [
      { label: 'Unassigned', value: '' },
      ...members().map(m => ({
        label: getMemberName(m),
        value: m.userId,
      })),
    ];
  });

  // Reset form when study changes or modal opens
  createEffect(() => {
    const study = props.study;
    if (study && props.open) {
      setReviewer1(study.reviewer1 || '');
      setReviewer2(study.reviewer2 || '');
    }
  });

  const handleSave = async () => {
    if (!props.study) return;

    setSaving(true);
    try {
      const updates = {
        reviewer1: reviewer1() || null,
        reviewer2: reviewer2() || null,
      };

      await props.onSave?.(props.study.id, updates);
      props.onOpenChange(false);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        toastTitle: 'Update Failed',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} title='Assign Reviewers' size='md'>
      <div class='space-y-4'>
        <p class='text-sm text-gray-600'>
          Assign two reviewers to this study. Each reviewer will independently complete their
          assessments.
        </p>

        {/* Reviewer Assignments */}
        <div class='space-y-4'>
          <div class='flex items-center gap-2 text-sm font-medium text-gray-900'>
            <BiRegularUser class='h-4 w-4' />
            <span>Reviewer Assignments</span>
          </div>

          <div class='grid grid-cols-2 gap-4'>
            <Select
              label='Reviewer 1'
              items={memberItems()}
              value={reviewer1()}
              onChange={setReviewer1}
              placeholder='Unassigned'
              disabledValues={reviewer2() ? [reviewer2()] : []}
              inDialog
            />
            <Select
              label='Reviewer 2'
              items={memberItems()}
              value={reviewer2()}
              onChange={setReviewer2}
              placeholder='Unassigned'
              disabledValues={reviewer1() ? [reviewer1()] : []}
              inDialog
            />
          </div>

          <Show when={members().length === 0}>
            <p class='text-sm text-gray-500'>
              No team members available. Add members to the project first.
            </p>
          </Show>
        </div>

        {/* Actions */}
        <div class='flex justify-end gap-3 border-t border-gray-200 pt-4'>
          <button
            type='button'
            onClick={() => props.onOpenChange(false)}
            disabled={saving()}
            class='rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleSave}
            disabled={saving()}
            class='rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50'
          >
            {saving() ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
