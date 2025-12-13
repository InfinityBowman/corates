import { Show, createEffect, createSignal, createMemo } from 'solid-js';
import { FiEdit2, FiX, FiCheck, FiChevronLeft } from 'solid-icons/fi';
import { useProjectContext } from './ProjectContext.jsx';

export default function ProjectHeader(props) {
  const { userRole } = useProjectContext();

  const canEdit = createMemo(() => {
    const role = userRole();
    return role === 'owner' || role === 'collaborator';
  });

  const [editing, setEditing] = createSignal(false);
  const [nameValue, setNameValue] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  createEffect(() => {
    setNameValue(props.name || '');
  });

  const startEditing = () => {
    setError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setNameValue(props.name || '');
    setError('');
    setEditing(false);
  };

  const handleSave = async () => {
    const trimmed = nameValue().trim();
    if (!trimmed) {
      setError('Project name is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await props.onRename?.(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err?.message || 'Failed to rename project');
    } finally {
      setSaving(false);
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
          <Show when={editing()}>
            <div class='flex items-center gap-2'>
              <input
                value={nameValue()}
                onInput={e => setNameValue(e.currentTarget.value)}
                class='text-2xl font-bold text-gray-900 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                aria-label='Project name'
                disabled={saving()}
              />
              <button
                type='button'
                onClick={handleSave}
                disabled={saving()}
                class='inline-flex items-center gap-1 px-2 py-1 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed'
              >
                <FiCheck class='w-4 h-4' />
                Save
              </button>
              <button
                type='button'
                onClick={cancelEditing}
                disabled={saving()}
                class='inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed'
              >
                <FiX class='w-4 h-4' />
                Cancel
              </button>
            </div>
          </Show>
          <Show when={!editing()}>
            <div class='flex items-center gap-2'>
              <h1 class='text-2xl font-bold text-gray-900'>{props.name}</h1>
              <Show when={canEdit()}>
                <button
                  type='button'
                  onClick={startEditing}
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
      <Show when={error()}>
        <p class='text-sm text-red-600 ml-10'>{error()}</p>
      </Show>
      <Show when={props.description}>
        <p class='text-gray-500 ml-10'>{props.description}</p>
      </Show>
    </div>
  );
}
