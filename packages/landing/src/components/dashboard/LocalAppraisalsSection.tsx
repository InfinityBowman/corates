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

export function LocalAppraisalsSection({ showHeader = true, showSignInPrompt }: LocalAppraisalsSectionProps) {
  const navigate = useNavigate();
  const animation = useAnimation();
  const checklists = useLocalChecklistsStore(s => s.checklists);
  const deleteChecklist = useLocalChecklistsStore(s => s.deleteChecklist);
  const updateChecklist = useLocalChecklistsStore(s => s.updateChecklist);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleOpen = useCallback((checklistId: string) => {
    navigate({ to: `/checklist/${checklistId}` as string });
  }, [navigate]);

  const handleDelete = useCallback((checklistId: string) => {
    setPendingDeleteId(checklistId);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (pendingDeleteId) await deleteChecklist(pendingDeleteId);
    setDeleteDialogOpen(false);
    setPendingDeleteId(null);
  }, [pendingDeleteId, deleteChecklist]);

  const handleRename = useCallback(async (checklistId: string, newName: string) => {
    await updateChecklist(checklistId, { name: newName });
  }, [updateChecklist]);

  const handleCreate = useCallback(() => {
    navigate({ to: '/checklist' as string });
  }, [navigate]);

  const hasChecklists = checklists?.length > 0;

  return (
    <section style={animation.fadeUp(300)}>
      {showHeader && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Local Appraisals
          </h2>
          {hasChecklists && (
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-all hover:bg-primary/5 hover:scale-105 hover:shadow-sm active:scale-100"
            >
              <PlusIcon className="h-4 w-4" />
              New
            </button>
          )}
        </div>
      )}

      {/* Sign-in prompt */}
      {showSignInPrompt && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <LogInIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Want to collaborate?</p>
              <p className="text-xs text-primary/70">Sign in to create projects and sync across devices</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: '/signin' })}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Appraisals list */}
      <div className="space-y-3">
        {!hasChecklists && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50 px-6 py-10">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
              <FileTextIcon className="h-6 w-6 text-muted-foreground/70" />
            </div>
            <h3 className="mb-1 text-sm font-medium text-secondary-foreground">No local appraisals</h3>
            <p className="mb-4 text-center text-xs text-muted-foreground">
              Create appraisals that stay on this device
            </p>
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <PlusIcon className="h-4 w-4" />
              Create Appraisal
            </button>
          </div>
        )}

        {(checklists as Array<{ id: string; name?: string; type?: string; checklistType?: string; updatedAt?: number; createdAt?: number }>)?.map((checklist, index) => (
          <LocalAppraisalCard
            key={checklist.id}
            checklist={checklist}
            onOpen={handleOpen}
            onDelete={handleDelete}
            onRename={(newName) => handleRename(checklist.id, newName)}
            style={animation.statRise(index * 50)}
          />
        ))}
      </div>

      {/* Delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant="danger">
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
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
