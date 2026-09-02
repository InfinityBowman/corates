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
        Send back to To-Do
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='warning' />
            <div>
              <AlertDialogTitle>Send this appraisal back to To-Do?</AlertDialogTitle>
              <AlertDialogDescription>
                Both reviewers get this appraisal back in their To-Do list and can change their
                answers. It returns here for reconciliation once they have both completed it again.
                {discardsReconciliation &&
                  ' The consensus appraisal started for this outcome, and every answer on it, is deleted permanently and cannot be recovered.'}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onSendBack}>Send back to To-Do</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
