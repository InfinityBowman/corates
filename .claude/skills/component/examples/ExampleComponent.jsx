/**
 * Example SolidJS Component Template
 *
 * Demonstrates all key patterns for CoRATES components.
 * Copy and modify for new components.
 */

import { createSignal, createMemo, createEffect, onMount, onCleanup, Show, For } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

// Icons - use solid-icons packages
import { FiEdit, FiTrash2, FiCheck, FiX } from 'solid-icons/fi';

// UI components - import from @corates/ui
import { Dialog, Tooltip, useConfirmDialog } from '@corates/ui';

// Stores - import directly, no prop drilling
import projectStore from '@/stores/projectStore.js';

// Primitives/hooks
import { useProjectData } from '@primitives/useProjectData.js';

/**
 * ExampleComponent
 *
 * @param {Object} props
 * @param {string} props.itemId - Required item identifier
 * @param {string} [props.title] - Optional display title
 * @param {Function} [props.onSave] - Callback when item is saved
 * @param {Function} [props.onDelete] - Callback when item is deleted
 */
export function ExampleComponent(props) {
  const navigate = useNavigate();
  const params = useParams();
  const confirmDialog = useConfirmDialog();

  // Refs for DOM access
  let containerRef;

  // ---------------------
  // Local State (signals)
  // ---------------------

  const [isEditing, setIsEditing] = createSignal(false);
  const [localValue, setLocalValue] = createSignal('');

  // ---------------------
  // Store Data (no prop drilling)
  // ---------------------

  // Option 1: Direct store access
  const item = () => projectStore.getItem(props.itemId);

  // Option 2: Using a hook
  const projectData = useProjectData(params.projectId);

  // ---------------------
  // Derived Values (createMemo)
  // ---------------------

  const displayTitle = createMemo(() => {
    return props.title || item()?.name || 'Untitled';
  });

  const stats = createMemo(() => {
    const data = item();
    if (!data) return { total: 0, completed: 0, percentage: 0 };

    const total = data.items?.length ?? 0;
    const completed = data.items?.filter((i) => i.done).length ?? 0;

    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  // Simple derived value as arrow function
  const canEdit = () => item()?.permissions?.includes('edit');
  const isComplete = () => stats().percentage === 100;

  // ---------------------
  // Effects
  // ---------------------

  // Sync local state when item changes
  createEffect(() => {
    const currentItem = item();
    if (currentItem) {
      setLocalValue(currentItem.value ?? '');
    }
  });

  // ---------------------
  // Lifecycle
  // ---------------------

  onMount(() => {
    // Focus container on mount
    containerRef?.focus();

    // Example: keyboard shortcut
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isEditing()) {
        setIsEditing(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Always clean up event listeners
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  // ---------------------
  // Event Handlers
  // ---------------------

  const handleSave = async () => {
    // Update store
    await projectStore.updateItem(props.itemId, { value: localValue() });

    // Call prop handler with optional chaining
    props.onSave?.(props.itemId, localValue());

    setIsEditing(false);
  };

  const handleDelete = async () => {
    // Use confirm dialog from @corates/ui
    const confirmed = await confirmDialog.confirm({
      title: 'Delete Item?',
      message: 'This action cannot be undone.',
    });

    if (confirmed) {
      await projectStore.deleteItem(props.itemId);
      props.onDelete?.(props.itemId);
    }
  };

  const handleCancel = () => {
    // Reset to original value
    setLocalValue(item()?.value ?? '');
    setIsEditing(false);
  };

  // ---------------------
  // Render
  // ---------------------

  return (
    <div
      ref={containerRef}
      class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      tabIndex={0}
    >
      {/* Header */}
      <div class="mb-4 flex items-center justify-between">
        <h3 class="font-semibold text-gray-900">{displayTitle()}</h3>

        <div class="flex items-center gap-2">
          {/* Edit button - only shown if user can edit */}
          <Show when={canEdit() && !isEditing()}>
            <Tooltip content="Edit">
              <button
                onClick={() => setIsEditing(true)}
                class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <FiEdit class="h-4 w-4" />
              </button>
            </Tooltip>
          </Show>

          {/* Delete button - stop propagation if inside clickable container */}
          <Show when={props.onDelete}>
            <Tooltip content="Delete">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                class="rounded-lg p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-600"
              >
                <FiTrash2 class="h-4 w-4" />
              </button>
            </Tooltip>
          </Show>
        </div>
      </div>

      {/* Content - switch between view and edit modes */}
      <Show
        when={isEditing()}
        fallback={
          <div class="text-gray-700">
            <p>{item()?.value || 'No content'}</p>
          </div>
        }
      >
        <div class="space-y-3">
          <textarea
            value={localValue()}
            onInput={(e) => setLocalValue(e.target.value)}
            class="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
          />

          <div class="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              <FiX class="h-4 w-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              class="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
            >
              <FiCheck class="h-4 w-4" />
              Save
            </button>
          </div>
        </div>
      </Show>

      {/* Stats footer */}
      <div class="mt-4 border-t border-gray-100 pt-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-500">Progress</span>
          <span class={isComplete() ? 'text-green-600' : 'text-gray-700'}>
            {stats().completed} / {stats().total} ({stats().percentage}%)
          </span>
        </div>

        {/* Progress bar */}
        <div class="mt-2 h-1.5 w-full rounded-full bg-gray-100">
          <div
            class={`h-full rounded-full transition-all ${isComplete() ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${stats().percentage}%` }}
          />
        </div>
      </div>

      {/* List rendering example */}
      <Show when={item()?.items?.length > 0}>
        <div class="mt-4 space-y-2">
          <For each={item().items}>
            {(subItem, index) => (
              <div
                class="flex items-center gap-2 rounded-lg bg-gray-50 p-2"
                classList={{ 'opacity-50': subItem.done }}
              >
                <span class="text-sm text-gray-600">
                  {index() + 1}. {subItem.name}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export default ExampleComponent;
