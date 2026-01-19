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
          class='border-border text-muted-foreground hover:border-border-strong hover:text-secondary-foreground flex h-9 w-9 items-center justify-center rounded-lg border transition-colors'
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
              class='text-foreground text-lg font-semibold'
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
                <p class='text-muted-foreground text-sm'>
                  {description() || (
                    <span class='text-muted-foreground/70 italic'>No description</span>
                  )}
                </p>
                <Show when={canEdit()}>
                  <button
                    onClick={startEditingDescription}
                    class='text-muted-foreground/70 hover:text-secondary-foreground opacity-0 transition-opacity group-hover:opacity-100'
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
                class='border-border bg-card text-secondary-foreground focus:border-primary focus:ring-primary/20 disabled:bg-secondary w-full max-w-lg resize-none rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus:ring-2 disabled:cursor-not-allowed'
                rows={2}
                placeholder='Add a project description...'
                disabled={isSaving()}
              />
              <div class='flex gap-2'>
                <button
                  onClick={saveDescription}
                  disabled={isSaving()}
                  class='bg-primary hover:bg-primary/90 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <FiCheck class='h-4 w-4' />
                  {isSaving() ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEditingDescription}
                  disabled={isSaving()}
                  class='bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
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
