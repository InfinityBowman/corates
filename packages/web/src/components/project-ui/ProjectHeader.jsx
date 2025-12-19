import { Show, createMemo, createSignal } from 'solid-js';
import { FiChevronLeft, FiEdit2, FiCheck, FiX } from 'solid-icons/fi';
import { useProjectContext } from './ProjectContext.jsx';
import { Editable, showToast } from '@corates/ui';

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
        console.error('Failed to rename project:', error);
        showToast({
          title: 'Failed to rename project',
          description: error.message || 'Please try again',
          type: 'error',
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
      console.error('Failed to update description:', error);
      showToast({
        title: 'Failed to update description',
        description: error.message || 'Please try again',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditingDescription = () => {
    setIsEditingDescription(false);
  };

  return (
    <div class='mb-8'>
      <div class='mb-2 flex items-center gap-4'>
        <button
          onClick={() => props.onBack()}
          class='text-gray-400 transition-colors hover:text-gray-700'
        >
          <FiChevronLeft class='h-6 w-6' />
        </button>
        <div class='flex min-w-0 flex-1 items-center gap-2'>
          <Editable
            activationMode='click'
            value={name()}
            onSubmit={handleNameChange}
            showEditIcon={canEdit()}
            readOnly={!canEdit()}
            class='-ml-2 text-2xl font-bold text-gray-900'
          />
        </div>
        <Show when={userRole()}>
          <span class='inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 capitalize'>
            {userRole()}
          </span>
        </Show>
      </div>

      {/* Description section */}
      <div class='ml-10'>
        <Show
          when={isEditingDescription()}
          fallback={
            <div class='group flex items-start gap-2'>
              <p class='flex-1 text-gray-500'>
                {description() || <span class='text-gray-400 italic'>No description</span>}
              </p>
              <Show when={canEdit()}>
                <button
                  onClick={startEditingDescription}
                  class='text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-600'
                  title='Edit description'
                >
                  <FiEdit2 class='h-4 w-4' />
                </button>
              </Show>
            </div>
          }
        >
          <div class='flex flex-col gap-2'>
            <textarea
              value={descriptionDraft()}
              onInput={e => setDescriptionDraft(e.target.value)}
              class='w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100'
              rows={3}
              placeholder='Add a project description...'
              disabled={isSaving()}
            />
            <div class='flex gap-2'>
              <button
                onClick={saveDescription}
                disabled={isSaving()}
                class='inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
              >
                <FiCheck class='h-4 w-4' />
                {isSaving() ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEditingDescription}
                disabled={isSaving()}
                class='inline-flex items-center gap-1 rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50'
              >
                <FiX class='h-4 w-4' />
                Cancel
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
