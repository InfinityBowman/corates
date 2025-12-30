/**
 * LocalAppraisalsPanel - Reusable panel for local appraisals
 *
 * Can be rendered in standalone dashboard or inside workspace pages.
 * Props:
 *  - compact: boolean - Show a more compact layout for embedding in workspace pages
 *  - showSignInPrompt: boolean - Show sign-in prompt (default: false when compact)
 */

import { For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import useLocalChecklists from '@primitives/useLocalChecklists.js';
import { useConfirmDialog } from '@corates/ui';
import { getChecklistMetadata } from '@/checklist-registry';
import { FiTrash2 } from 'solid-icons/fi';
import { Editable } from '@corates/ui';

export default function LocalAppraisalsPanel(props) {
  const navigate = useNavigate();

  const compact = () => props.compact ?? false;
  const showSignInPrompt = () => props.showSignInPrompt ?? false;
  const showHeader = () => props.showHeader ?? true;

  const { checklists, loading, deleteChecklist, updateChecklist } = useLocalChecklists();

  // Confirm dialog for delete actions
  const confirmDialog = useConfirmDialog();

  const openChecklist = checklistId => {
    navigate(`/checklist/${checklistId}`);
  };

  const handleDelete = async (e, checklistId) => {
    e.stopPropagation();
    const confirmed = await confirmDialog.open({
      title: 'Delete Appraisal',
      description: 'Are you sure you want to delete this appraisal? This cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      await deleteChecklist(checklistId);
    }
  };

  return (
    <div class={compact() ? 'space-y-4' : 'space-y-6'}>
      {/* Header - optional */}
      <Show when={showHeader()}>
        <div class='flex items-center justify-between'>
          <div>
            <h2
              class={
                compact() ?
                  'text-lg font-semibold text-gray-900'
                : 'text-2xl font-bold text-gray-900'
              }
            >
              Local Appraisals
            </h2>
            <Show when={!compact()}>
              <p class='mt-1 text-gray-500'>Create and manage appraisals locally on this device</p>
            </Show>
          </div>
          <button
            class={
              compact() ?
                'inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'
              : 'inline-flex transform items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:bg-blue-700 hover:shadow-lg'
            }
            onClick={() => navigate('/checklist')}
          >
            <span class={compact() ? 'text-sm' : 'text-lg'}>+</span>
            {compact() ? 'New' : 'New Appraisal'}
          </button>
        </div>
      </Show>

      {/* Sign in prompt - only show when requested */}
      <Show when={showSignInPrompt()}>
        <div class='flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4'>
          <div>
            <p class='font-medium text-blue-800'>Want to collaborate with others?</p>
            <p class='text-sm text-blue-600'>
              Sign in to create projects, invite team members, and sync across devices.
            </p>
          </div>
          <button
            onClick={() => navigate('/signin')}
            class='rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700'
          >
            Sign In
          </button>
        </div>
      </Show>

      {/* Checklists Grid */}
      <div
        class={compact() ? 'grid gap-3 md:grid-cols-2' : 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'}
      >
        <Show
          when={checklists().length > 0}
          fallback={
            <Show when={!loading()}>
              <div
                class={`col-span-full rounded-lg border-2 border-dashed border-gray-300 bg-white text-center ${compact() ? 'py-6' : 'py-12'}`}
              >
                <div class='mb-2 text-sm text-gray-500'>No local appraisals</div>
                <button
                  onClick={() => navigate('/checklist')}
                  class='text-sm font-medium text-blue-600 hover:text-blue-700'
                >
                  Create an appraisal
                </button>
              </div>
            </Show>
          }
        >
          <For each={checklists()}>
            {checklist => (
              <div
                class={`group relative rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md ${compact() ? 'p-4' : 'p-6'}`}
              >
                {/* Local badge */}
                <div class='absolute top-2 right-2'>
                  <span class='inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600'>
                    Local
                  </span>
                </div>
                <div class={compact() ? 'mb-3 pr-12' : 'mb-4'}>
                  <Editable
                    activationMode='click'
                    variant='heading'
                    class={
                      compact() ?
                        'text-base font-semibold text-gray-900'
                      : 'text-lg font-semibold text-gray-900'
                    }
                    value={checklist.name}
                    showEditIcon={true}
                    onSubmit={newName => updateChecklist(checklist.id, { name: newName })}
                  />
                  <p class='text-xs text-gray-500'>
                    {getChecklistMetadata(checklist.checklistType).name}
                  </p>
                </div>

                <div
                  class={`flex items-center justify-between text-xs text-gray-500 ${compact() ? 'mb-3' : 'mb-4'}`}
                >
                  <span>
                    Updated{' '}
                    {new Date(checklist.updatedAt || checklist.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div class='flex gap-2'>
                  <button
                    onClick={() => openChecklist(checklist.id)}
                    class={`flex-1 rounded-lg font-medium text-white transition-colors ${compact() ? 'bg-gray-700 px-3 py-1.5 text-sm hover:bg-gray-800' : 'bg-blue-600 px-4 py-2 hover:bg-blue-700'}`}
                  >
                    Open
                  </button>
                  <button
                    onClick={e => handleDelete(e, checklist.id)}
                    class='rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                    title='Delete appraisal'
                  >
                    <FiTrash2 class={compact() ? 'h-4 w-4' : 'h-5 w-5'} />
                  </button>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>

      <confirmDialog.ConfirmDialogComponent />
    </div>
  );
}
