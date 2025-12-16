import { Show, createEffect, createSignal, createMemo } from 'solid-js';
import { FiEdit2, FiX, FiCheck, FiChevronLeft } from 'solid-icons/fi';
import { useProjectContext } from './ProjectContext.jsx';

export default function ProjectHeader(props) {
  const { userRole } = useProjectContext();

  const canEdit = createMemo(() => {
    const role = userRole();
    return role === 'owner' || role === 'collaborator';
  });

  // Name editing state
  const [editingName, setEditingName] = createSignal(false);
  const [nameValue, setNameValue] = createSignal('');
  const [savingName, setSavingName] = createSignal(false);
  const [nameError, setNameError] = createSignal('');

  // Description editing state
  const [editingDescription, setEditingDescription] = createSignal(false);
  const [descriptionValue, setDescriptionValue] = createSignal('');
  const [savingDescription, setSavingDescription] = createSignal(false);
  const [descriptionError, setDescriptionError] = createSignal('');

  createEffect(() => {
    setNameValue(props.name || '');
  });

  createEffect(() => {
    setDescriptionValue(props.description || '');
  });

  // Name editing handlers
  const startEditingName = () => {
    setNameError('');
    setEditingName(true);
  };

  const cancelEditingName = () => {
    setNameValue(props.name || '');
    setNameError('');
    setEditingName(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue().trim();
    if (!trimmed) {
      setNameError('Project name is required');
      return;
    }

    setSavingName(true);
    setNameError('');
    try {
      await props.onRename?.(trimmed);
      setEditingName(false);
    } catch (err) {
      setNameError(err?.message || 'Failed to rename project');
    } finally {
      setSavingName(false);
    }
  };

  // Description editing handlers
  const startEditingDescription = () => {
    setDescriptionError('');
    setEditingDescription(true);
  };

  const cancelEditingDescription = () => {
    setDescriptionValue(props.description || '');
    setDescriptionError('');
    setEditingDescription(false);
  };

  const handleSaveDescription = async () => {
    const trimmed = descriptionValue().trim();
    setSavingDescription(true);
    setDescriptionError('');
    try {
      await props.onUpdateDescription?.(trimmed);
      setEditingDescription(false);
    } catch (err) {
      setDescriptionError(err?.message || 'Failed to update description');
    } finally {
      setSavingDescription(false);
    }
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
        <div class='flex items-center gap-2 flex-wrap'>
          <Show when={editingName()}>
            <div class='flex items-center gap-2'>
              <input
                value={nameValue()}
                onInput={e => setNameValue(e.currentTarget.value)}
                class='text-2xl font-bold text-gray-900 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                aria-label='Project name'
                disabled={savingName()}
              />
              <button
                type='button'
                onClick={handleSaveName}
                disabled={savingName()}
                class='inline-flex items-center gap-1 px-2 py-1 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed'
              >
                <FiCheck class='w-4 h-4' />
                Save
              </button>
              <button
                type='button'
                onClick={cancelEditingName}
                disabled={savingName()}
                class='inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed'
              >
                <FiX class='w-4 h-4' />
                Cancel
              </button>
            </div>
          </Show>
          <Show when={!editingName()}>
            <div class='flex items-center gap-2'>
              <h1 class='text-2xl font-bold text-gray-900'>{props.name}</h1>
              <Show when={canEdit()}>
                <button
                  type='button'
                  onClick={startEditingName}
                  class='inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100'
                  aria-label='Rename project'
                >
                  <FiEdit2 class='w-4 h-4' />
                  Rename
                </button>
              </Show>
            </div>
          </Show>
        </div>
        <Show when={userRole()}>
          <span class='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize'>
            {userRole()}
          </span>
        </Show>
      </div>
      <Show when={nameError()}>
        <p class='text-sm text-red-600 ml-10'>{nameError()}</p>
      </Show>

      {/* Description section */}
      <div class='ml-10'>
        <Show
          when={editingDescription()}
          fallback={
            <div class='flex items-center gap-2 group'>
              <p class='text-gray-500'>
                {props.description || <span class='italic text-gray-400'>No description</span>}
              </p>
              <Show when={canEdit()}>
                <button
                  type='button'
                  onClick={startEditingDescription}
                  class='inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity'
                  aria-label='Edit description'
                >
                  <FiEdit2 class='w-3 h-3' />
                  Edit
                </button>
              </Show>
            </div>
          }
        >
          <div class='flex items-start gap-2 max-w-xl'>
            <textarea
              value={descriptionValue()}
              onInput={e => setDescriptionValue(e.currentTarget.value)}
              class='flex-1 text-gray-700 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none'
              aria-label='Project description'
              disabled={savingDescription()}
              rows={3}
              placeholder='Add a project description...'
            />
            <div class='flex flex-col gap-1'>
              <button
                type='button'
                onClick={handleSaveDescription}
                disabled={savingDescription()}
                class='inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed'
              >
                <FiCheck class='w-4 h-4' />
                Save
              </button>
              <button
                type='button'
                onClick={cancelEditingDescription}
                disabled={savingDescription()}
                class='inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed'
              >
                <FiX class='w-4 h-4' />
                Cancel
              </button>
            </div>
          </div>
          <Show when={descriptionError()}>
            <p class='text-sm text-red-600 mt-1'>{descriptionError()}</p>
          </Show>
        </Show>
      </div>
    </div>
  );
}
