/**
 * ReopenReconciliationButton - Confirmation-gated action that moves a finalized
 * reconciliation back to the reconcile tab. Consensus answers are preserved.
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

interface ReopenReconciliationButtonProps {
  onReopen: () => void;
}

export function ReopenReconciliationButton({ onReopen }: ReopenReconciliationButtonProps) {
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
        Reopen
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='warning' />
            <div>
              <AlertDialogTitle>Reopen Reconciliation</AlertDialogTitle>
              <AlertDialogDescription>
                This moves the study back to the Reconcile tab. Consensus answers are kept and can
                be edited before finalizing again. Until then, this checklist will not appear in
                results or exports.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onReopen}>Reopen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
