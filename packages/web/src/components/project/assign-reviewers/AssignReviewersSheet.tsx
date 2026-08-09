/**
 * AssignReviewersSheet - Hosts the bulk ReviewerAssignment flow in a side sheet,
 * opened from the project header.
 */

import { useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ReviewerAssignment } from './ReviewerAssignment';
import { useAllStudies, useProjectMembers } from '@/project/workspace-data';
import { project } from '@/project';
import { useProjectContext } from '../ProjectContext';

interface AssignReviewersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignReviewersSheet({ open, onOpenChange }: AssignReviewersSheetProps) {
  const { projectId } = useProjectContext();

  const studies = useAllStudies(projectId);
  const members = useProjectMembers(projectId);

  const handleAssignReviewers = useCallback((studyId: string, updates: Record<string, unknown>) => {
    project.study.update(studyId, updates);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-full gap-0 overflow-y-auto sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>Assign reviewers</SheetTitle>
          <SheetDescription>
            Distribute unassigned studies across the team. Individual studies can be reassigned from
            their card in the study list.
          </SheetDescription>
        </SheetHeader>
        <div className='p-4'>
          <ReviewerAssignment
            studies={studies}
            members={members}
            onAssignReviewers={handleAssignReviewers}
            onDone={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
