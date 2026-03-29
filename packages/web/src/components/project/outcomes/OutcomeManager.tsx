/**
 * OutcomeManager - Manages project-level outcomes for ROB-2 and ROBINS-I checklists
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronRightIcon, PlusIcon, PencilIcon, Trash2Icon, CheckIcon, XIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useProjectStore } from '@/stores/projectStore';
import { project } from '@/project';
import { useProjectContext } from '../ProjectContext';
import { showToast } from '@/components/ui/toast';

export function OutcomeManager() {
  const { projectId, isOwner } = useProjectContext();

  const [expanded, setExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const meta = useProjectStore(s => s.projects[projectId]?.meta) as any;
  const outcomes: any[] = useMemo(() => meta?.outcomes || [], [meta]);

  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setIsSaving(true);
    try {
      const outcomeId = await project.outcome.create(name);
      if (outcomeId) {
        setNewName('');
        setIsAdding(false);
        showToast.success('Outcome added');
      } else {
        showToast.error('Failed to add outcome');
      }
    } catch (err: any) {
      showToast.error('Failed to add outcome', err.message);
    } finally {
      setIsSaving(false);
    }
  }, [newName]);

  const handleUpdate = useCallback(
    async (outcomeId: string) => {
      const name = newName.trim();
      if (!name) return;
      setIsSaving(true);
      try {
        const success = await project.outcome.update(outcomeId, name);
        if (success) {
          setNewName('');
          setEditingId(null);
          showToast.success('Outcome updated');
        } else {
          showToast.error('Failed to update outcome');
        }
      } catch (err: any) {
        showToast.error('Failed to update outcome', err.message);
      } finally {
        setIsSaving(false);
      }
    },
    [newName],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    try {
      const result = project.outcome.delete(deleteTarget);
      if (result?.success) {
        showToast.success('Outcome deleted');
      } else {
        showToast.error(
          'Cannot delete outcome',
          result?.error || 'Outcome is in use by checklists',
        );
      }
    } catch (err: any) {
      showToast.error('Failed to delete outcome', err.message);
    }
    setDeleteTarget(null);
  }, [deleteTarget]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, onEnter: () => void, onEscape: () => void) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEnter();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    },
    [],
  );

  const handleHeaderClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      setExpanded(!expanded);
    },
    [expanded],
  );

  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border'>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div
          className='flex cursor-pointer items-center gap-3 px-4 py-3 select-none'
          onClick={handleHeaderClick}
        >
          <div className='-ml-1 shrink-0 p-1'>
            <ChevronRightIcon
              className={`text-muted-foreground/70 size-5 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            />
          </div>

          <div className='min-w-0 flex-1'>
            <span className='text-foreground font-medium'>Outcomes</span>
            <span className='text-muted-foreground ml-2 text-sm'>
              {outcomes.length === 0 ?
                'None defined'
              : outcomes.length === 1 ?
                '1 outcome'
              : `${outcomes.length} outcomes`}
            </span>
          </div>

          {isOwner && (
            <button
              onClick={e => {
                e.stopPropagation();
                setIsAdding(true);
                setExpanded(true);
                setNewName('');
              }}
              className='text-muted-foreground hover:text-primary flex items-center gap-1 text-sm transition-colors'
            >
              <PlusIcon className='size-4' />
              Add
            </button>
          )}
        </div>

        <CollapsibleContent>
          <div className='border-border flex flex-col gap-2 border-t px-4 py-3'>
            {/* Add form */}
            {isAdding && (
              <div className='flex items-center gap-2'>
                <label htmlFor='outcome-new-name' className='sr-only'>
                  Outcome name
                </label>
                <input
                  id='outcome-new-name'
                  type='text'
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e =>
                    handleKeyDown(e, handleAdd, () => {
                      setIsAdding(false);
                      setNewName('');
                    })
                  }
                  placeholder='Outcome name (e.g., Overall mortality)'
                  className='border-border focus:border-primary flex-1 rounded border px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-200 focus:outline-none'
                  autoFocus
                />
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim() || isSaving}
                  className='text-primary hover:text-primary/80 p-1.5 transition-colors disabled:opacity-50'
                  title='Add'
                  aria-label='Add'
                >
                  <CheckIcon className='size-4' />
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewName('');
                  }}
                  className='text-muted-foreground hover:text-foreground p-1.5 transition-colors'
                  title='Cancel'
                  aria-label='Cancel'
                >
                  <XIcon className='size-4' />
                </button>
              </div>
            )}

            {/* Empty state */}
            {outcomes.length === 0 && !isAdding && (
              <p className='text-muted-foreground text-sm'>
                No outcomes defined. Add outcomes to enable ROB-2 and ROBINS-I checklists.
              </p>
            )}

            {/* Outcomes list */}
            {outcomes.map((outcome: any) =>
              editingId === outcome.id ?
                <div key={outcome.id} className='flex items-center gap-2'>
                  <label htmlFor={`outcome-edit-${outcome.id}`} className='sr-only'>
                    Outcome name
                  </label>
                  <input
                    id={`outcome-edit-${outcome.id}`}
                    type='text'
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e =>
                      handleKeyDown(
                        e,
                        () => handleUpdate(outcome.id),
                        () => {
                          setEditingId(null);
                          setNewName('');
                        },
                      )
                    }
                    placeholder='Outcome name'
                    className='border-border focus:border-primary flex-1 rounded border px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-200 focus:outline-none'
                    autoFocus
                  />
                  <button
                    onClick={() => handleUpdate(outcome.id)}
                    disabled={!newName.trim() || isSaving}
                    className='text-primary hover:text-primary/80 p-1.5 transition-colors disabled:opacity-50'
                    title='Save'
                    aria-label='Save'
                  >
                    <CheckIcon className='size-4' />
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setNewName('');
                    }}
                    className='text-muted-foreground hover:text-foreground p-1.5 transition-colors'
                    title='Cancel'
                    aria-label='Cancel'
                  >
                    <XIcon className='size-4' />
                  </button>
                </div>
              : <div key={outcome.id} className='flex items-center gap-2'>
                  <span className='text-foreground min-w-0 flex-1 truncate text-sm'>
                    {outcome.name}
                  </span>
                  {isOwner && (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(outcome.id);
                          setNewName(outcome.name);
                        }}
                        className='text-muted-foreground hover:text-foreground p-1 transition-colors'
                        title='Edit'
                        aria-label='Edit'
                      >
                        <PencilIcon className='size-3.5' />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(outcome.id)}
                        className='text-muted-foreground p-1 transition-colors hover:text-red-600'
                        title='Delete'
                        aria-label='Delete'
                      >
                        <Trash2Icon className='size-3.5' />
                      </button>
                    </>
                  )}
                </div>,
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Outcome</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this outcome? This will fail if any checklists use it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
