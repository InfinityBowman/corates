/**
 * LocalAppraisalsSection - Device-local appraisals with delete/rename
 */

import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PlusIcon, FileTextIcon, LogInIcon, TriangleAlertIcon } from 'lucide-react';
import { useLocalChecklistsStore } from '@/stores/localChecklistsStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAnimation } from './useInitialAnimation';
import { LocalAppraisalCard } from './LocalAppraisalCard';

interface LocalAppraisalsSectionProps {
  showHeader?: boolean;
  showSignInPrompt?: boolean;
}

export function LocalAppraisalsSection({
  showHeader = true,
  showSignInPrompt,
}: LocalAppraisalsSectionProps) {
  const navigate = useNavigate();
  const animation = useAnimation();
  const checklists = useLocalChecklistsStore(s => s.checklists);
  const deleteChecklist = useLocalChecklistsStore(s => s.deleteChecklist);
  const updateChecklist = useLocalChecklistsStore(s => s.updateChecklist);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleOpen = useCallback(
    (checklistId: string) => {
      navigate({ to: `/checklist/${checklistId}` as string });
    },
    [navigate],
  );

  const handleDelete = useCallback((checklistId: string) => {
    setPendingDeleteId(checklistId);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (pendingDeleteId) await deleteChecklist(pendingDeleteId);
    setDeleteDialogOpen(false);
    setPendingDeleteId(null);
  }, [pendingDeleteId, deleteChecklist]);

  const handleRename = useCallback(
    async (checklistId: string, newName: string) => {
      await updateChecklist(checklistId, { name: newName });
    },
    [updateChecklist],
  );

  const handleCreate = useCallback(() => {
    navigate({ to: '/checklist' as string });
  }, [navigate]);

  const hasChecklists = checklists?.length > 0;

  return (
    <section style={animation.fadeUp(300)}>
      {showHeader && (
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
            Local Appraisals
          </h2>
          {hasChecklists && (
            <button
              type='button'
              onClick={handleCreate}
              className='text-primary hover:bg-primary/5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 hover:shadow-sm active:scale-100'
            >
              <PlusIcon className='size-4' />
              New
            </button>
          )}
        </div>
      )}

      {/* Sign-in prompt */}
      {showSignInPrompt && (
        <div className='border-primary/20 bg-primary/5 mb-4 flex items-center justify-between rounded-xl border p-4'>
          <div className='flex items-center gap-3'>
            <div className='bg-primary/10 flex size-10 items-center justify-center rounded-lg'>
              <LogInIcon className='text-primary size-5' />
            </div>
            <div>
              <p className='text-primary text-sm font-medium'>Want to collaborate?</p>
              <p className='text-primary/70 text-xs'>
                Sign in to create projects and sync across devices
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={() => navigate({ to: '/signin' })}
            className='bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
          >
            Sign In
          </button>
        </div>
      )}

      {/* Appraisals list */}
      <div className='flex flex-col gap-3'>
        {!hasChecklists && (
          <div className='border-border bg-muted/50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10'>
            <div className='bg-secondary mb-3 flex size-12 items-center justify-center rounded-xl'>
              <FileTextIcon className='text-muted-foreground/70 size-6' />
            </div>
            <h3 className='text-secondary-foreground mb-1 text-sm font-medium'>
              No local appraisals
            </h3>
            <p className='text-muted-foreground mb-4 text-center text-xs'>
              Create appraisals that stay on this device
            </p>
            <button
              type='button'
              onClick={handleCreate}
              className='bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
            >
              <PlusIcon className='size-4' />
              Create Appraisal
            </button>
          </div>
        )}

        {(
          checklists as Array<{
            id: string;
            name?: string;
            type?: string;
            checklistType?: string;
            updatedAt?: number;
            createdAt?: number;
          }>
        )?.map((checklist, index) => (
          <LocalAppraisalCard
            key={checklist.id}
            checklist={checklist}
            onOpen={handleOpen}
            onDelete={handleDelete}
            onRename={newName => handleRename(checklist.id, newName)}
            style={animation.statRise(index * 50)}
          />
        ))}
      </div>

      {/* Delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='danger'>
              <TriangleAlertIcon />
            </AlertDialogIcon>
            <div>
              <AlertDialogTitle>Delete Appraisal</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this appraisal? This cannot be undone.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
