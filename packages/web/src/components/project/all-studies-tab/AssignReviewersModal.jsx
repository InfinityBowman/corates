/**
 * AssignReviewersModal - Modal for assigning reviewers to a study
 *
 * Fields:
 * - Reviewer 1 select
 * - Reviewer 2 select
 */

import { createSignal, createEffect, createMemo, Show } from 'solid-js';
import { SimpleSelect } from '@/components/ui/select';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { BiRegularUser } from 'solid-icons/bi';
import { FiX } from 'solid-icons/fi';
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
  const [selectsReady, setSimpleSelectsReady] = createSignal(false);

  const members = () => projectStore.getMembers(props.projectId) || [];

  // Get studies array reactively to establish reactive dependency
  const studies = () => projectStore.getStudies(props.projectId) || [];

  // Get the current study from store by ID (ensures we always get latest data)
  const currentStudy = createMemo(() => {
    const studyId = props.study?.id;
    if (!studyId) return null;
    // Access studies array reactively, then find by ID
    const allStudies = studies();
    return allStudies.find(s => s.id === studyId) || null;
  });

  // Convert members to SimpleSelect items format
  const memberItems = createMemo(() => {
    const getMemberName = member => member?.name || member?.email || 'Unknown';

    return [
      { label: 'Unassigned', value: '' },
      ...members().map(m => ({
        label: getMemberName(m),
        value: m.userId,
      })),
    ];
  });

  // Disabled values for each reviewer select (prevent selecting the same reviewer twice)
  const reviewer1DisabledValues = createMemo(() => (reviewer2() ? [reviewer2()] : []));
  const reviewer2DisabledValues = createMemo(() => (reviewer1() ? [reviewer1()] : []));

  // Reset form when study changes or modal opens
  // Track study ID explicitly to ensure effect re-runs when switching studies
  createEffect(() => {
    const studyId = props.study?.id;
    const isOpen = props.open;
    const study = currentStudy();

    if (isOpen && studyId && study) {
      // Sync from the store's current study data
      setReviewer1(study.reviewer1 || '');
      setReviewer2(study.reviewer2 || '');

      // Small delay to ensure SimpleSelect components are ready before rendering
      setSimpleSelectsReady(true);
    } else if (!isOpen) {
      // Reset when modal closes
      setReviewer1('');
      setReviewer2('');
      setSimpleSelectsReady(false);
    }
  });

  const handleSave = async () => {
    const study = currentStudy();
    if (!study) return;

    setSaving(true);
    try {
      const updates = {
        reviewer1: reviewer1() || null,
        reviewer2: reviewer2() || null,
      };

      await props.onSave?.(study.id, updates);
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
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent class='max-w-md'>
          <DialogHeader>
            <DialogTitle>Assign Reviewers</DialogTitle>
            <DialogCloseTrigger aria-label='Close'>
              <FiX class='h-5 w-5' />
            </DialogCloseTrigger>
          </DialogHeader>
          <DialogBody>
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

                <Show when={selectsReady()} fallback={<div class='grid h-20 grid-cols-2 gap-4' />}>
                  <div class='grid grid-cols-2 gap-4'>
                    <SimpleSelect
                      label='Reviewer 1'
                      items={memberItems()}
                      value={reviewer1()}
                      onChange={setReviewer1}
                      placeholder='Unassigned'
                      disabledValues={reviewer1DisabledValues()}
                      inDialog={true}
                    />
                    <SimpleSelect
                      label='Reviewer 2'
                      items={memberItems()}
                      value={reviewer2()}
                      onChange={setReviewer2}
                      placeholder='Unassigned'
                      disabledValues={reviewer2DisabledValues()}
                      inDialog={true}
                    />
                  </div>
                </Show>

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
          </DialogBody>
        </DialogContent>
      </DialogPositioner>
    </Dialog>
  );
}
