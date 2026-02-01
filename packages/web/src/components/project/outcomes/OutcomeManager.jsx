/**
 * OutcomeManager - Manages project-level outcomes
 * Compact collapsible panel for managing outcomes used by ROB-2 and ROBINS-I checklists
 */

import { For, Show, createSignal, createMemo } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX } from 'solid-icons/fi';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { useProjectContext } from '../ProjectContext.jsx';
import { showToast } from '@/components/ui/toast';

export default function OutcomeManager() {
  const { projectId, isOwner } = useProjectContext();

  const [expanded, setExpanded] = createSignal(false);
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
    setExpanded(true);
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

  const handleHeaderClick = e => {
    const target = e.target;
    if (target.closest('button')) return;
    setExpanded(!expanded());
  };

  return (
    <div class='border-border bg-card overflow-hidden rounded-lg border'>
      <Collapsible open={expanded()}>
        <div
          class='flex cursor-pointer items-center gap-3 px-4 py-3 select-none'
          onClick={handleHeaderClick}
        >
          <div class='-ml-1 shrink-0 p-1'>
            <BiRegularChevronRight
              class={`text-muted-foreground/70 h-5 w-5 transition-transform duration-200 ${expanded() ? 'rotate-90' : ''}`}
            />
          </div>

          <div class='min-w-0 flex-1'>
            <span class='text-foreground font-medium'>Outcomes</span>
            <span class='text-muted-foreground ml-2 text-sm'>
              {outcomes().length === 0 ?
                'None defined'
              : outcomes().length === 1 ?
                '1 outcome'
              : `${outcomes().length} outcomes`}
            </span>
          </div>

          <Show when={canEdit()}>
            <button
              onClick={e => {
                e.stopPropagation();
                startAdd();
              }}
              class='text-muted-foreground hover:text-primary flex items-center gap-1 text-sm transition-colors'
            >
              <FiPlus class='h-4 w-4' />
              Add
            </button>
          </Show>
        </div>

        <CollapsibleContent>
          <div class='border-border-subtle space-y-2 border-t px-4 py-3'>
            {/* Add form */}
            <Show when={isAdding()}>
              <div class='flex items-center gap-2'>
                <input
                  type='text'
                  value={newName()}
                  onInput={e => setNewName(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, handleAdd, cancelAdd)}
                  placeholder='Outcome name (e.g., Overall mortality)'
                  class='border-border focus:border-primary flex-1 rounded border px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-200 focus:outline-none'
                  autofocus
                />
                <button
                  onClick={handleAdd}
                  disabled={!newName().trim() || isSaving()}
                  class='text-primary hover:text-primary/80 p-1.5 transition-colors disabled:opacity-50'
                  title='Add'
                >
                  <FiCheck class='h-4 w-4' />
                </button>
                <button
                  onClick={cancelAdd}
                  class='text-muted-foreground hover:text-foreground p-1.5 transition-colors'
                  title='Cancel'
                >
                  <FiX class='h-4 w-4' />
                </button>
              </div>
            </Show>

            {/* Outcomes list */}
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
                    <div class='flex items-center gap-2'>
                      <span class='text-foreground min-w-0 flex-1 truncate text-sm'>
                        {outcome.name}
                      </span>
                      <Show when={canEdit()}>
                        <button
                          onClick={() => startEdit(outcome)}
                          class='text-muted-foreground hover:text-foreground p-1 transition-colors'
                          title='Edit'
                        >
                          <FiEdit2 class='h-3.5 w-3.5' />
                        </button>
                        <button
                          onClick={() => handleDelete(outcome.id)}
                          class='text-muted-foreground p-1 transition-colors hover:text-red-600'
                          title='Delete'
                        >
                          <FiTrash2 class='h-3.5 w-3.5' />
                        </button>
                      </Show>
                    </div>
                  }
                >
                  <div class='flex items-center gap-2'>
                    <input
                      type='text'
                      value={newName()}
                      onInput={e => setNewName(e.target.value)}
                      // eslint-disable-next-line solid/reactivity -- Event handler is a tracked context
                      onKeyDown={e => handleKeyDown(e, () => handleUpdate(outcome.id), cancelEdit)}
                      placeholder='Outcome name'
                      class='border-border focus:border-primary flex-1 rounded border px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-200 focus:outline-none'
                      autofocus
                    />
                    <button
                      onClick={() => handleUpdate(outcome.id)}
                      disabled={!newName().trim() || isSaving()}
                      class='text-primary hover:text-primary/80 p-1.5 transition-colors disabled:opacity-50'
                      title='Save'
                    >
                      <FiCheck class='h-4 w-4' />
                    </button>
                    <button
                      onClick={cancelEdit}
                      class='text-muted-foreground hover:text-foreground p-1.5 transition-colors'
                      title='Cancel'
                    >
                      <FiX class='h-4 w-4' />
                    </button>
                  </div>
                </Show>
              )}
            </For>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
