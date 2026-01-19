/**
 * LocalAppraisalsPanel - Reusable panel for local appraisals
 *
 * Can be rendered in standalone dashboard or inside workspace pages.
 * Props:
 *  - compact: boolean - Show a more compact layout for embedding in workspace pages
 *  - showSignInPrompt: boolean - Show sign-in prompt (default: false when compact)
 */

import { For, Show, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import localChecklistsStore from '@/stores/localChecklistsStore';
import { getChecklistMetadata } from '@/checklist-registry';
import { FiTrash2 } from 'solid-icons/fi';
import { SimpleEditable } from '@/components/ui/editable';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogPositioner,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

export default function LocalAppraisalsPanel(props) {
  const navigate = useNavigate();

  const showSignInPrompt = () => props.showSignInPrompt ?? false;
  const showHeader = () => props.showHeader ?? true;

  const { checklists, loading, deleteChecklist, updateChecklist } = localChecklistsStore;

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const [pendingDeleteId, setPendingDeleteId] = createSignal(null);

  const openChecklist = checklistId => {
    navigate(`/checklist/${checklistId}`);
  };

  const handleDelete = (e, checklistId) => {
    e.stopPropagation();
    setPendingDeleteId(checklistId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    const checklistId = pendingDeleteId();
    if (checklistId) {
      await deleteChecklist(checklistId);
    }
    setDeleteDialogOpen(false);
    setPendingDeleteId(null);
  };

  return (
    <div class={'space-y-6'}>
      {/* Header - optional */}
      <Show when={showHeader()}>
        <div class='flex items-center justify-between'>
          <div>
            <h2 class='text-foreground text-2xl font-bold'>Local Appraisals</h2>

            <p class='text-muted-foreground mt-1'>
              Create and manage appraisals locally on this device
            </p>
          </div>
          <button
            class='inline-flex transform items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:bg-blue-700 hover:shadow-lg'
            onClick={() => navigate('/checklist')}
          >
            <span class='text-lg'>+</span>
            New Appraisal
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
      <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Show
          when={checklists().length > 0}
          fallback={
            <Show when={!loading()}>
              <div class='border-border bg-card col-span-full rounded-lg border-2 border-dashed py-12 text-center'>
                <div class='text-muted-foreground mb-2 text-sm'>No local appraisals</div>
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
              <div class='group border-border bg-card hover:border-border relative rounded-lg border p-6 shadow-sm transition-all duration-200 hover:shadow-md'>
                {/* Local badge */}
                <div class='absolute top-2 right-2'>
                  <span class='bg-secondary text-muted-foreground inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium'>
                    Local
                  </span>
                </div>
                <div class='mb-4'>
                  <SimpleEditable
                    activationMode='click'
                    variant='heading'
                    class='text-foreground text-lg font-semibold'
                    value={checklist.name}
                    showEditIcon={true}
                    onSubmit={newName => updateChecklist(checklist.id, { name: newName })}
                  />
                  <p class='text-muted-foreground text-xs'>
                    {getChecklistMetadata(checklist.type).name}
                  </p>
                </div>

                <div class='text-muted-foreground mb-4 flex items-center justify-between text-xs'>
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
                    class='text-muted-foreground/70 focus:ring-primary rounded-lg p-1.5 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:outline-none'
                    title='Delete appraisal'
                  >
                    <FiTrash2 class='h-5 w-5' />
                  </button>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen()} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogBackdrop />
        <AlertDialogPositioner>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogIcon variant='danger' />
              <div>
                <AlertDialogTitle>Delete Appraisal</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this appraisal? This cannot be undone.
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant='danger' onClick={confirmDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogPositioner>
      </AlertDialog>
    </div>
  );
}
