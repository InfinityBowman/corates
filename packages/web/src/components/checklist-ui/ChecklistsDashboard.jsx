import { createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import useLocalChecklists from '@primitives/useLocalChecklists.js';
import { ConfirmDialog, useConfirmDialog } from '@components/zag/Dialog.jsx';

export default function ChecklistsDashboard(props) {
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [newChecklistName, setNewChecklistName] = createSignal('');
  const [isCreating, setIsCreating] = createSignal(false);

  const isLoggedIn = () => props.isLoggedIn ?? false;

  const { checklists, loading, createChecklist, deleteChecklist } = useLocalChecklists();

  // Confirm dialog for delete actions
  const confirmDialog = useConfirmDialog();

  const handleCreate = async () => {
    if (!newChecklistName().trim()) return;

    setIsCreating(true);
    try {
      const checklist = await createChecklist(newChecklistName().trim());
      if (checklist) {
        setNewChecklistName('');
        setShowCreateForm(false);
        // Navigate to the new checklist
        navigate(`/checklist/${checklist.id}`);
      }
    } catch (error) {
      console.error('Error creating checklist:', error);
      alert('Failed to create checklist. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

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
      <div class='flex justify-between items-center'>
        <div>
          <h1 class='text-2xl font-bold text-gray-900'>My Checklists</h1>
          <p class='text-gray-500 mt-1'>
            Create and manage AMSTAR2 checklists locally on this device
          </p>
        </div>
        <button
          class='inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg gap-2'
          onClick={() => setShowCreateForm(!showCreateForm())}
        >
          <span class='text-lg'>+</span>
          New Checklist
        </button>
      </div>

      {/* Sign in prompt - only show when not logged in */}
      <Show when={!isLoggedIn()}>
        <div class='bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between'>
          <div>
            <p class='text-blue-800 font-medium'>Want to collaborate with others?</p>
            <p class='text-blue-600 text-sm'>
              Sign in to create projects, invite team members, and sync across devices.
            </p>
          </div>
          <button
            onClick={() => navigate('/signin')}
            class='px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors'
          >
            Sign In
          </button>
        </div>
      </Show>

      {/* Create Appraisal Form */}
      <Show when={showCreateForm()}>
        <div class='bg-white p-6 rounded-lg border border-gray-200 shadow-sm'>
          <h3 class='text-lg font-semibold text-gray-900 mb-4'>Start a New Appraisal</h3>

          <div class='space-y-4'>
            <div>
              <label class='block text-sm font-semibold text-gray-700 mb-2'>Appraisal Name</label>
              <input
                type='text'
                placeholder='e.g., Sleep Study Review'
                value={newChecklistName()}
                onInput={e => setNewChecklistName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                class='w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
              />
            </div>
          </div>

          <div class='flex gap-3 mt-6'>
            <button
              onClick={handleCreate}
              disabled={isCreating() || !newChecklistName().trim()}
              class='inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md'
            >
              {isCreating() ? 'Creating...' : 'Create Checklist'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              class='px-4 py-2 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:border-blue-300 hover:text-blue-600 transition-colors'
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>

      {/* Checklists Grid */}
      <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Show
          when={checklists().length > 0}
          fallback={
            <Show when={!loading()}>
              <div class='col-span-full text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300'>
                <div class='text-gray-500 mb-4'>No checklists yet</div>
                <button
                  onClick={() => setShowCreateForm(true)}
                  class='text-blue-600 hover:text-blue-700 font-medium'
                >
                  Create your first checklist
                </button>
              </div>
            </Show>
          }
        >
          <For each={checklists()}>
            {checklist => (
              <div class='bg-white border border-gray-200 rounded-lg shadow-sm p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200 group relative'>
                {/* Local badge */}
                <div class='absolute top-3 right-3'>
                  <span class='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600'>
                    Local
                  </span>
                </div>

                <div class='mb-4'>
                  <h3 class='text-lg font-semibold text-gray-900 mb-2 pr-12'>{checklist.name}</h3>
                  <p class='text-gray-500 text-sm'>AMSTAR2 Checklist</p>
                </div>

                <div class='flex items-center justify-between text-xs text-gray-500 mb-4'>
                  <span>
                    Updated{' '}
                    {new Date(checklist.updatedAt || checklist.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div class='flex gap-2'>
                  <button
                    onClick={() => openChecklist(checklist.id)}
                    class='flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors font-medium'
                  >
                    Open
                  </button>
                  <button
                    onClick={e => handleDelete(e, checklist.id)}
                    class='p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                    title='Delete checklist'
                  >
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      class='h-5 w-5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      stroke-width='2'
                    >
                      <path
                        stroke-linecap='round'
                        stroke-linejoin='round'
                        d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                      />
                    </svg>
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
