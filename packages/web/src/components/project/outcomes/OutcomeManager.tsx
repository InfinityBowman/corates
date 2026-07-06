/**
 * OutcomeManager - Manages project-level outcomes for ROB-2 and ROBINS-I checklists
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronRightIcon, PlusIcon, PencilIcon, Trash2Icon, CheckIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { project } from '@/project';
import { useProjectContext } from '../ProjectContext';
import { useProjectMetaById } from '@/primitives/useProject/reactor';
import { showToast } from '@/lib/toast';

export function OutcomeManager() {
  const { projectId, isOwner } = useProjectContext();

  const [expanded, setExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const meta = useProjectMetaById(projectId);
  const outcomes = useMemo(() => meta?.outcomes ?? [], [meta]);

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
    } catch (err: unknown) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Failed to Add Outcome' });
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
      } catch (err: unknown) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Failed to Update Outcome' });
      } finally {
        setIsSaving(false);
      }
    },
    [newName],
  );

  const confirmDelete = useCallback(async () => {
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
    } catch (err: unknown) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Failed to Delete Outcome' });
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
            <Button
              variant='ghost'
              size='sm'
              onClick={e => {
                e.stopPropagation();
                setIsAdding(true);
                setExpanded(true);
                setNewName('');
              }}
              className='text-muted-foreground'
            >
              <PlusIcon className='size-4' />
              Add
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <div className='border-border flex flex-col gap-2 border-t px-4 py-3'>
            {/* Add form */}
            {isAdding && (
              <div className='flex items-center gap-2'>
                <Label htmlFor='outcome-new-name' className='sr-only'>
                  Outcome name
                </Label>
                <Input
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
                  className='flex-1'
                  autoFocus
                />
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={handleAdd}
                  disabled={!newName.trim() || isSaving}
                  className='text-primary hover:text-primary'
                  title='Add'
                  aria-label='Add'
                >
                  <CheckIcon className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => {
                    setIsAdding(false);
                    setNewName('');
                  }}
                  className='text-muted-foreground'
                  title='Cancel'
                  aria-label='Cancel'
                >
                  <XIcon className='size-4' />
                </Button>
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
                  <Label htmlFor={`outcome-edit-${outcome.id}`} className='sr-only'>
                    Outcome name
                  </Label>
                  <Input
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
                    className='flex-1'
                    autoFocus
                  />
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => handleUpdate(outcome.id)}
                    disabled={!newName.trim() || isSaving}
                    className='text-primary hover:text-primary'
                    title='Save'
                    aria-label='Save'
                  >
                    <CheckIcon className='size-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => {
                      setEditingId(null);
                      setNewName('');
                    }}
                    className='text-muted-foreground'
                    title='Cancel'
                    aria-label='Cancel'
                  >
                    <XIcon className='size-4' />
                  </Button>
                </div>
              : <div key={outcome.id} className='flex items-center gap-2'>
                  <span className='text-foreground min-w-0 flex-1 truncate text-sm'>
                    {outcome.name}
                  </span>
                  {isOwner && (
                    <>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        onClick={() => {
                          setEditingId(outcome.id);
                          setNewName(outcome.name);
                        }}
                        className='text-muted-foreground'
                        title='Edit'
                        aria-label='Edit'
                      >
                        <PencilIcon className='size-3.5' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        onClick={() => setDeleteTarget(outcome.id)}
                        className='text-muted-foreground hover:text-red-600'
                        title='Delete'
                        aria-label='Delete'
                      >
                        <Trash2Icon className='size-3.5' />
                      </Button>
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
