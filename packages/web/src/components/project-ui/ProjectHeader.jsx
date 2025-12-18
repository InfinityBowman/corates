import { Show, createMemo, createSignal, createEffect } from 'solid-js';
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

  createEffect(() => {
    console.log(name());
  });

  return (
    <div class='mb-8'>
      <div class='flex items-center gap-4 mb-2'>
        <button
          onClick={() => props.onBack()}
          class='text-gray-400 hover:text-gray-700 transition-colors'
        >
          <FiChevronLeft class='w-6 h-6' />
        </button>
        <div class='flex items-center gap-2 flex-1 min-w-0'>
          <Editable
            activationMode='click'
            variant='heading'
            value={name()}
            onSubmit={handleNameChange}
            showEditIcon={canEdit()}
            readOnly={!canEdit()}
            class='text-2xl font-bold text-gray-900'
          />
        </div>
        <Show when={userRole()}>
          <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize'>
            {userRole()}
          </span>
        </Show>
      </div>

      {/* Description section */}
      <div class='ml-10'>
        <Show
          when={isEditingDescription()}
          fallback={
            <div class='flex items-start gap-2 group'>
              <p class='text-gray-500 flex-1'>
                {description() || <span class='italic text-gray-400'>No description</span>}
              </p>
              <Show when={canEdit()}>
                <button
                  onClick={startEditingDescription}
                  class='text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity'
                  title='Edit description'
                >
                  <FiEdit2 class='w-4 h-4' />
                </button>
              </Show>
            </div>
          }
        >
          <div class='flex flex-col gap-2'>
            <textarea
              value={descriptionDraft()}
              onInput={e => setDescriptionDraft(e.target.value)}
              class='w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed'
              rows={3}
              placeholder='Add a project description...'
              disabled={isSaving()}
            />
            <div class='flex gap-2'>
              <button
                onClick={saveDescription}
                disabled={isSaving()}
                class='inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <FiCheck class='w-4 h-4' />
                {isSaving() ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEditingDescription}
                disabled={isSaving()}
                class='inline-flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <FiX class='w-4 h-4' />
                Cancel
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
