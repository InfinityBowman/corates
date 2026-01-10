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

import { Show, For, useContext } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useConfirmDialog } from '@corates/ui';
import { FiPlus, FiFileText, FiLogIn } from 'solid-icons/fi';

import { AnimationContext } from './Dashboard.jsx';

import localChecklistsStore from '@/stores/localChecklistsStore';
import { LocalAppraisalCard } from './LocalAppraisalCard.jsx';

/**
 * Empty state for no local appraisals
 */
function EmptyLocalState(props) {
  return (
    <div class='flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50 px-6 py-10'>
      <div class='mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100'>
        <FiFileText class='h-6 w-6 text-stone-400' />
      </div>
      <h3 class='mb-1 text-sm font-medium text-stone-700'>No local appraisals</h3>
      <p class='mb-4 text-center text-xs text-stone-500'>
        Create appraisals that stay on this device
      </p>
      <button
        type='button'
        onClick={() => props.onCreateClick?.()}
        class='flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
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
          <FiLogIn class='h-5 w-5 text-blue-600' />
        </div>
        <div>
          <p class='text-sm font-medium text-blue-800'>Want to collaborate?</p>
          <p class='text-xs text-blue-600'>Sign in to create projects and sync across devices</p>
        </div>
      </div>
      <button
        type='button'
        onClick={() => props.onSignIn?.()}
        class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
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
  const confirmDialog = useConfirmDialog();

  const { checklists, deleteChecklist, updateChecklist } = localChecklistsStore;

  const handleOpen = checklistId => {
    navigate(`/checklist/${checklistId}`);
  };

  const handleDelete = async checklistId => {
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
          <h2 class='text-sm font-semibold tracking-wide text-stone-500 uppercase'>
            Local Appraisals
          </h2>
          <Show when={hasChecklists()}>
            <button
              type='button'
              onClick={handleCreate}
              class='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition-all hover:scale-105 hover:bg-blue-50 hover:shadow-sm active:scale-100'
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

      <confirmDialog.ConfirmDialogComponent />
    </section>
  );
}

export default LocalAppraisalsSection;
