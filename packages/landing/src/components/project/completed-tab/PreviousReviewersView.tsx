/**
 * PreviousReviewersView - Stub for viewing original reviewer checklists
 * TODO(agent): Migrate when GenericChecklist (Phase 4.7) is available
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/* eslint-disable no-unused-vars */
interface PreviousReviewersViewProps {
  study: any;
  reconciliationProgress: any;
  getAssigneeName: (userId: string) => string;
  onClose: () => void;
}
/* eslint-enable no-unused-vars */

export function PreviousReviewersView({ onClose }: PreviousReviewersViewProps) {
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle>Original Reviewer Appraisals</DialogTitle>
          <DialogDescription>
            The original appraisals from each reviewer that were reconciled to create the final
            version.
          </DialogDescription>
        </DialogHeader>
        <div className='flex items-center justify-center py-16'>
          <p className='text-muted-foreground'>
            Reviewer comparison view will be available after checklist forms are migrated.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
