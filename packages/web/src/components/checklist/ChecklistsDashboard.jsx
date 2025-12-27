import { For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import useLocalChecklists from '@primitives/useLocalChecklists.js';
import { useConfirmDialog } from '@corates/ui';
import { getChecklistMetadata } from '@/checklist-registry';
import { FiTrash2 } from 'solid-icons/fi';
import { Editable } from '@corates/ui';

export default function ChecklistsDashboard(props) {
  const navigate = useNavigate();

  const isLoggedIn = () => props.isLoggedIn ?? false;

  const { checklists, loading, deleteChecklist, updateChecklist } = useLocalChecklists();

  // Confirm dialog for delete actions
  const confirmDialog = useConfirmDialog();

  const openChecklist = checklistId => {
    navigate(`/checklist/${checklistId}`);
  };

  const handleDelete = async (e, checklistId) => {
    e.stopPropagation();
    const confirmed = await confirmDialog.open({
      title: 'Delete Checklist',
      description: 'Are you sure you want to delete this checklist? This cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      await deleteChecklist(checklistId);
    }
  };

  return (
    <div class='space-y-6'>
      {/* Header */}
      <div class='flex items-center justify-between'>
        <div>
          <h1 class='text-2xl font-bold text-gray-900'>My Appraisals</h1>
          <p class='mt-1 text-gray-500'>Create and manage appraisals locally on this device</p>
        </div>
        <button
          class='inline-flex transform items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:bg-blue-700 hover:shadow-lg'
          onClick={() => navigate('/checklist')}
        >
          <span class='text-lg'>+</span>
          New Appraisal
        </button>
      </div>

      {/* Sign in prompt - only show when not logged in */}
      <Show when={!isLoggedIn()}>
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
      <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Show
          when={checklists().length > 0}
          fallback={
            <Show when={!loading()}>
              <div class='col-span-full rounded-lg border-2 border-dashed border-gray-300 bg-white py-12 text-center'>
                <div class='mb-4 text-gray-500'>No appraisals yet</div>
                <button
                  onClick={() => navigate('/checklist')}
                  class='font-medium text-blue-600 hover:text-blue-700'
                >
                  Create your first appraisal
                </button>
              </div>
            </Show>
          }
        >
          <For each={checklists()}>
            {checklist => (
              <div class='group relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md'>
                {/* Local badge */}
                <div class='absolute top-3 right-3'>
                  <span class='inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600'>
                    Local
                  </span>
                </div>
                <div class='mb-4'>
                  <Editable
                    activationMode='click'
                    variant='heading'
                    class='text-lg font-semibold text-gray-900'
                    value={checklist.name}
                    showEditIcon={true}
                    onSubmit={newName => updateChecklist(checklist.id, { name: newName })}
                  />
                  <p class='text-sm text-gray-500'>
                    {getChecklistMetadata(checklist.checklistType).name}
                  </p>
                </div>

                <div class='mb-4 flex items-center justify-between text-xs text-gray-500'>
                  <span>
                    Updated{' '}
                    {new Date(checklist.updatedAt || checklist.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div class='flex gap-2'>
                  <button
                    onClick={() => openChecklist(checklist.id)}
                    class='flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700'
                  >
                    Open
                  </button>
                  <button
                    onClick={e => handleDelete(e, checklist.id)}
                    class='rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                    title='Delete checklist'
                  >
                    <FiTrash2 class='h-5 w-5' />
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
