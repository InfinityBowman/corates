/**
 * LocalAppraisalsSection - Section for device-local appraisals
 *
 * Features:
 * - Compact horizontal card layout
 * - Create new appraisal button
 * - Delete with confirmation
 * - Inline rename
 * - Sign-in prompt for logged-out users
 */

import { Show, For, useContext, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
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
import { FiPlus, FiFileText, FiLogIn } from 'solid-icons/fi';

import { AnimationContext } from './Dashboard.jsx';

import localChecklistsStore from '@/stores/localChecklistsStore';
import { LocalAppraisalCard } from './LocalAppraisalCard.jsx';

/**
 * Empty state for no local appraisals
 */
function EmptyLocalState(props) {
  return (
    <div class='border-border bg-muted/50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10'>
      <div class='bg-secondary mb-3 flex h-12 w-12 items-center justify-center rounded-xl'>
        <FiFileText class='text-muted-foreground/70 h-6 w-6' />
      </div>
      <h3 class='text-secondary-foreground mb-1 text-sm font-medium'>No local appraisals</h3>
      <p class='text-muted-foreground mb-4 text-center text-xs'>
        Create appraisals that stay on this device
      </p>
      <button
        type='button'
        onClick={() => props.onCreateClick?.()}
        class='bg-primary hover:bg-primary/90 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors'
      >
        <FiPlus class='h-4 w-4' />
        Create Appraisal
      </button>
    </div>
  );
}

/**
 * Sign-in prompt banner
 */
function SignInPrompt(props) {
  return (
    <div class='flex items-center justify-between rounded-xl border border-blue-100 bg-white/50 p-4'>
      <div class='flex items-center gap-3'>
        <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100'>
          <FiLogIn class='text-primary h-5 w-5' />
        </div>
        <div>
          <p class='text-primary text-sm font-medium'>Want to collaborate?</p>
          <p class='text-primary text-xs'>Sign in to create projects and sync across devices</p>
        </div>
      </div>
      <button
        type='button'
        onClick={() => props.onSignIn?.()}
        class='bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors'
      >
        Sign In
      </button>
    </div>
  );
}

/**
 * Local appraisals section component
 * @param {Object} props
 * @param {boolean} [props.showHeader] - Whether to show section header
 * @param {boolean} [props.showSignInPrompt] - Whether to show sign-in prompt
 */
export function LocalAppraisalsSection(props) {
  const navigate = useNavigate();

  const { checklists, deleteChecklist, updateChecklist } = localChecklistsStore;

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const [pendingDeleteId, setPendingDeleteId] = createSignal(null);

  const handleOpen = checklistId => {
    navigate(`/checklist/${checklistId}`);
  };

  const handleDelete = checklistId => {
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

  const handleRename = async (checklistId, newName) => {
    await updateChecklist(checklistId, { name: newName });
  };

  const handleCreate = () => {
    navigate('/checklist');
  };

  const handleSignIn = () => {
    navigate('/signin');
  };

  const hasChecklists = () => checklists()?.length > 0;

  const animation = useContext(AnimationContext);

  return (
    <section style={animation.fadeUp(300)}>
      {/* Header */}
      <Show when={props.showHeader !== false}>
        <div class='mb-4 flex items-center justify-between'>
          <h2 class='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
            Local Appraisals
          </h2>
          <Show when={hasChecklists()}>
            <button
              type='button'
              onClick={handleCreate}
              class='text-primary hover:bg-primary-subtle flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 hover:shadow-sm active:scale-100'
            >
              <FiPlus class='h-4 w-4' />
              New
            </button>
          </Show>
        </div>
      </Show>

      {/* Sign-in prompt */}
      <Show when={props.showSignInPrompt}>
        <div class='mb-4'>
          <SignInPrompt onSignIn={handleSignIn} />
        </div>
      </Show>

      {/* Appraisals list */}
      <div class='space-y-3'>
        {/* Empty state */}
        <Show when={!hasChecklists()}>
          <EmptyLocalState onCreateClick={handleCreate} />
        </Show>

        {/* Appraisal cards */}
        <For each={checklists()}>
          {(checklist, index) => (
            <LocalAppraisalCard
              checklist={checklist}
              onOpen={handleOpen}
              onDelete={handleDelete}
              onRename={newName => handleRename(checklist.id, newName)}
              style={animation.statRise(index() * 50)}
            />
          )}
        </For>
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
    </section>
  );
}

export default LocalAppraisalsSection;
