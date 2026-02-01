/**
 * OutcomeManager - Manages project-level outcomes
 * Displays list of outcomes with add/edit/delete functionality
 */

import { For, Show, createSignal, createMemo } from 'solid-js';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX } from 'solid-icons/fi';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useProjectContext } from '../ProjectContext.jsx';
import { showToast } from '@/components/ui/toast';

export default function OutcomeManager() {
  const { projectId, isOwner } = useProjectContext();

  const [isAdding, setIsAdding] = createSignal(false);
  const [editingId, setEditingId] = createSignal(null);
  const [newName, setNewName] = createSignal('');
  const [isSaving, setIsSaving] = createSignal(false);

  const meta = () => projectStore.getMeta(projectId);
  const outcomes = createMemo(() => meta()?.outcomes || []);

  const canEdit = () => isOwner();

  const handleAdd = async () => {
    const name = newName().trim();
    if (!name) return;

    setIsSaving(true);
    try {
      const outcomeId = await projectActionsStore.outcome.create(name);
      if (outcomeId) {
        setNewName('');
        setIsAdding(false);
        showToast.success('Outcome added');
      } else {
        showToast.error('Failed to add outcome');
      }
    } catch (err) {
      showToast.error('Failed to add outcome', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async outcomeId => {
    const name = newName().trim();
    if (!name) return;

    setIsSaving(true);
    try {
      const success = projectActionsStore.outcome.update(outcomeId, name);
      if (success) {
        setNewName('');
        setEditingId(null);
        showToast.success('Outcome updated');
      } else {
        showToast.error('Failed to update outcome');
      }
    } catch (err) {
      showToast.error('Failed to update outcome', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async outcomeId => {
    if (!confirm('Delete this outcome? This will fail if any checklists use it.')) {
      return;
    }

    try {
      const result = projectActionsStore.outcome.delete(outcomeId);
      if (result?.success) {
        showToast.success('Outcome deleted');
      } else {
        showToast.error(
          'Cannot delete outcome',
          result?.error || 'Outcome is in use by checklists',
        );
      }
    } catch (err) {
      showToast.error('Failed to delete outcome', err.message);
    }
  };

  const startEdit = outcome => {
    setEditingId(outcome.id);
    setNewName(outcome.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewName('');
  };

  const startAdd = () => {
    setIsAdding(true);
    setNewName('');
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNewName('');
  };

  const handleKeyDown = (e, onEnter, onEscape) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnter();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEscape();
    }
  };

  return (
    <div class='bg-card border-border rounded-lg border p-4'>
      <div class='mb-3 flex items-center justify-between'>
        <div>
          <h3 class='text-foreground text-base font-semibold'>Outcomes</h3>
          <p class='text-muted-foreground text-xs'>
            Define outcomes for ROB-2 and ROBINS-I assessments
          </p>
        </div>
        <Show when={canEdit() && !isAdding()}>
          <button
            onClick={startAdd}
            class='bg-primary hover:bg-primary/90 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors'
          >
            <FiPlus class='h-4 w-4' />
            Add Outcome
          </button>
        </Show>
      </div>

      {/* Add form */}
      <Show when={isAdding()}>
        <div class='mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3'>
          <input
            type='text'
            value={newName()}
            onInput={e => setNewName(e.target.value)}
            onKeyDown={e => handleKeyDown(e, handleAdd, cancelAdd)}
            placeholder='Outcome name (e.g., Overall mortality, Quality of life)'
            class='border-border focus:border-primary w-full rounded border px-3 py-2 text-sm focus:ring-1 focus:ring-blue-200 focus:outline-none'
            autofocus
          />
          <div class='mt-2 flex gap-2'>
            <button
              onClick={handleAdd}
              disabled={!newName().trim() || isSaving()}
              class='bg-primary hover:bg-primary/90 flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50'
            >
              <FiCheck class='h-4 w-4' />
              Add
            </button>
            <button
              onClick={cancelAdd}
              class='border-border bg-card text-secondary-foreground hover:bg-muted flex items-center gap-1 rounded border px-3 py-1.5 text-sm transition-colors'
            >
              <FiX class='h-4 w-4' />
              Cancel
            </button>
          </div>
        </div>
      </Show>

      {/* Outcomes list */}
      <div class='space-y-2'>
        <Show when={outcomes().length === 0 && !isAdding()}>
          <p class='text-muted-foreground text-sm'>
            No outcomes defined. Add outcomes to enable ROB-2 and ROBINS-I checklists.
          </p>
        </Show>

        <For each={outcomes()}>
          {outcome => (
            <Show
              when={editingId() === outcome.id}
              fallback={
                <div class='border-border hover:border-border-strong flex items-center justify-between rounded-lg border bg-white p-3 transition-colors'>
                  <div class='min-w-0 flex-1'>
                    <p class='text-foreground font-medium'>{outcome.name}</p>
                  </div>
                  <Show when={canEdit()}>
                    <div class='flex gap-1'>
                      <button
                        onClick={() => startEdit(outcome)}
                        class='text-muted-foreground hover:text-foreground p-1.5 transition-colors'
                        title='Edit outcome'
                      >
                        <FiEdit2 class='h-4 w-4' />
                      </button>
                      <button
                        onClick={() => handleDelete(outcome.id)}
                        class='text-muted-foreground p-1.5 transition-colors hover:text-red-600'
                        title='Delete outcome'
                      >
                        <FiTrash2 class='h-4 w-4' />
                      </button>
                    </div>
                  </Show>
                </div>
              }
            >
              <div class='rounded-lg border border-blue-200 bg-blue-50 p-3'>
                <input
                  type='text'
                  value={newName()}
                  onInput={e => setNewName(e.target.value)}
                  // eslint-disable-next-line solid/reactivity -- Event handler is a tracked context
                  onKeyDown={e => handleKeyDown(e, () => handleUpdate(outcome.id), cancelEdit)}
                  placeholder='Outcome name'
                  class='border-border focus:border-primary w-full rounded border px-3 py-2 text-sm focus:ring-1 focus:ring-blue-200 focus:outline-none'
                  autofocus
                />
                <div class='mt-2 flex gap-2'>
                  <button
                    onClick={() => handleUpdate(outcome.id)}
                    disabled={!newName().trim() || isSaving()}
                    class='bg-primary hover:bg-primary/90 flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50'
                  >
                    <FiCheck class='h-4 w-4' />
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    class='border-border bg-card text-secondary-foreground hover:bg-muted flex items-center gap-1 rounded border px-3 py-1.5 text-sm transition-colors'
                  >
                    <FiX class='h-4 w-4' />
                    Cancel
                  </button>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}
