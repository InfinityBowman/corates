import { Show, createMemo, createSignal } from 'solid-js';
import { FiChevronLeft, FiEdit2, FiCheck, FiX } from 'solid-icons/fi';
import { useProjectContext } from './ProjectContext.jsx';
import { Editable } from '@corates/ui';

export default function ProjectHeader(props) {
  const { userRole } = useProjectContext();
  const [isEditingDescription, setIsEditingDescription] = createSignal(false);
  const [descriptionDraft, setDescriptionDraft] = createSignal('');

  const canEdit = createMemo(() => {
    const role = userRole();
    return role === 'owner' || role === 'collaborator';
  });

  const handleNameChange = newName => {
    if (newName && newName.trim() && newName !== props.name) {
      props.onRename?.(newName.trim());
    }
  };

  const startEditingDescription = () => {
    setDescriptionDraft(props.description || '');
    setIsEditingDescription(true);
  };

  const saveDescription = () => {
    const newDesc = descriptionDraft().trim();
    if (newDesc !== props.description) {
      props.onDescriptionChange?.(newDesc);
    }
    setIsEditingDescription(false);
  };

  const cancelEditingDescription = () => {
    setIsEditingDescription(false);
  };

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
            activationMode='dblclick'
            variant='heading'
            value={props.name || 'Untitled Project'}
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
                {props.description || <span class='italic text-gray-400'>No description</span>}
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
              class='w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
              rows={3}
              placeholder='Add a project description...'
            />
            <div class='flex gap-2'>
              <button
                onClick={saveDescription}
                class='inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm'
              >
                <FiCheck class='w-4 h-4' />
                Save
              </button>
              <button
                onClick={cancelEditingDescription}
                class='inline-flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm'
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
