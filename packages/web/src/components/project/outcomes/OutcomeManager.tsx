/**
 * OutcomeManager - Manages project-level outcomes for ROB-2 and ROBINS-I checklists
 */

import { useState, useCallback } from 'react';
import { PlusIcon, PencilIcon, Trash2Icon, CheckIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useProjectOutcomes } from '@/project/workspace-data';
import { showToast } from '@/lib/toast';

export function OutcomeManager() {
  const { projectId } = useProjectContext();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const outcomes = useProjectOutcomes(projectId);

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
        showToast.error('Could not add the outcome');
      }
    } catch (err: unknown) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not add the outcome' });
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
          showToast.error('Could not rename the outcome');
        }
      } catch (err: unknown) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Could not rename the outcome' });
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
          'Could not delete the outcome',
          result?.error || 'This outcome is still used by an appraisal.',
        );
      }
    } catch (err: unknown) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not delete the outcome' });
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

  return (
    <div className='flex flex-col gap-2'>
      {!isAdding && (
        <Button
          variant='outline'
          size='sm'
          className='self-start'
          onClick={() => {
            setIsAdding(true);
            setNewName('');
          }}
        >
          <PlusIcon className='size-4' />
          Add outcome
        </Button>
      )}

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
            title='Add outcome'
            aria-label='Add outcome'
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
          No outcomes yet. Add one to start a RoB 2 or ROBINS-I checklist. AMSTAR 2 checklists do
          not need an outcome.
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
              title='Save outcome name'
              aria-label='Save outcome name'
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
            <span className='text-foreground min-w-0 flex-1 truncate text-sm'>{outcome.name}</span>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => {
                setEditingId(outcome.id);
                setNewName(outcome.name);
              }}
              className='text-muted-foreground'
              title='Rename outcome'
              aria-label='Rename outcome'
            >
              <PencilIcon className='size-3.5' />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => setDeleteTarget(outcome.id)}
              className='text-muted-foreground hover:text-red-600'
              title='Delete outcome'
              aria-label='Delete outcome'
            >
              <Trash2Icon className='size-3.5' />
            </Button>
          </div>,
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this outcome?</AlertDialogTitle>
            <AlertDialogDescription>
              The outcome is removed from the project and cannot be recovered. Outcomes that are
              already used by a checklist cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={confirmDelete}>
              Delete outcome
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
