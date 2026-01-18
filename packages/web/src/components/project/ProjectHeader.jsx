import { Show, createMemo, createSignal } from 'solid-js';
import { FiArrowLeft, FiEdit2, FiCheck, FiX } from 'solid-icons/fi';
import { useProjectContext } from './ProjectContext.jsx';
import { SimpleEditable } from '@/components/ui/editable';
import { handleError } from '@/lib/error-utils.js';

export default function ProjectHeader(props) {
  const { userRole } = useProjectContext();
  const [isEditingDescription, setIsEditingDescription] = createSignal(false);
  const [descriptionDraft, setDescriptionDraft] = createSignal('');
  const [isSaving, setIsSaving] = createSignal(false);

  // Resolve props that may be getters or values
  const name = () => (typeof props.name === 'function' ? props.name() : props.name);
  const description = () =>
    typeof props.description === 'function' ? props.description() : props.description;

  const canEdit = createMemo(() => {
    const role = userRole();
    return role === 'owner' || role === 'collaborator';
  });

  const handleNameChange = async newName => {
    if (newName && newName.trim() && newName !== name()) {
      try {
        await props.onRename?.(newName.trim());
      } catch (error) {
        await handleError(error, {
          toastTitle: 'Failed to rename project',
        });
      }
    }
  };

  const startEditingDescription = () => {
    setDescriptionDraft(description() || '');
    setIsEditingDescription(true);
  };

  const saveDescription = async () => {
    const newDesc = descriptionDraft().trim();
    const currentDesc = description() || '';
    if (newDesc === currentDesc) {
      setIsEditingDescription(false);
      return;
    }

    setIsSaving(true);
    try {
      await props.onUpdateDescription?.(newDesc);
      setIsEditingDescription(false);
    } catch (error) {
      await handleError(error, {
        toastTitle: 'Failed to update description',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditingDescription = () => {
    setIsEditingDescription(false);
  };

  return (
    <div class='flex items-center justify-between py-4'>
      <div class='flex items-center gap-4'>
        <button
          onClick={() => props.onBack()}
          class='flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700'
        >
          <FiArrowLeft class='h-4 w-4' />
        </button>
        <div class='min-w-0'>
          <div class='flex items-center gap-2'>
            <SimpleEditable
              activationMode='click'
              value={name()}
              onSubmit={handleNameChange}
              showEditIcon={canEdit()}
              readOnly={!canEdit()}
              class='text-lg font-semibold text-slate-900'
            />
            <Show when={userRole()}>
              <span class='inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize'>
                {userRole()}
              </span>
            </Show>
          </div>
          <Show
            when={isEditingDescription()}
            fallback={
              <div class='group flex items-center gap-2'>
                <p class='text-sm text-slate-500'>
                  {description() || <span class='text-slate-400 italic'>No description</span>}
                </p>
                <Show when={canEdit()}>
                  <button
                    onClick={startEditingDescription}
                    class='text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-slate-600'
                    title='Edit description'
                  >
                    <FiEdit2 class='h-3.5 w-3.5' />
                  </button>
                </Show>
              </div>
            }
          >
            <div class='mt-2 flex flex-col gap-2'>
              <textarea
                value={descriptionDraft()}
                onInput={e => setDescriptionDraft(e.target.value)}
                class='w-full max-w-lg resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100'
                rows={2}
                placeholder='Add a project description...'
                disabled={isSaving()}
              />
              <div class='flex gap-2'>
                <button
                  onClick={saveDescription}
                  disabled={isSaving()}
                  class='inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <FiCheck class='h-4 w-4' />
                  {isSaving() ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEditingDescription}
                  disabled={isSaving()}
                  class='inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <FiX class='h-4 w-4' />
                  Cancel
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
