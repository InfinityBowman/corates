/**
 * SendBackToTodoButton - Confirmation-gated action that returns an outcome
 * group's reviewer checklists to the To-Do phase. Any consensus checklist that
 * reconciliation already produced is discarded, so the copy changes to say so.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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

interface SendBackToTodoButtonProps {
  onSendBack: () => void;
  discardsReconciliation: boolean;
}

export function SendBackToTodoButton({
  onSendBack,
  discardsReconciliation,
}: SendBackToTodoButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <Button
        variant='secondary'
        onClick={e => {
          e.stopPropagation();
          setShowConfirm(true);
        }}
      >
        Send Back
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='warning' />
            <div>
              <AlertDialogTitle>Send Back to To-Do</AlertDialogTitle>
              <AlertDialogDescription>
                Each reviewer gets this appraisal back in their To-Do list and can edit their
                answers again.
                {discardsReconciliation &&
                  ' The consensus checklist started for this outcome, and all answers on it, will be permanently deleted.'}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onSendBack}>Send Back</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
