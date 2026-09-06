/**
 * AssignReviewersSheet - Hosts ReviewerAssignment in a side sheet, scoped by
 * whoever opened it: the header (all unassigned), the post-add toast (just
 * added), or a study card (that study).
 */

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ReviewerAssignment } from './ReviewerAssignment';
import { useAllStudies, useProjectMembers } from '@/project/workspace-data';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { project } from '@/project';
import { useProjectContext } from '../ProjectContext';

interface AssignReviewersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignReviewersSheet({ open, onOpenChange }: AssignReviewersSheetProps) {
  const { projectId, assignSheetScope } = useProjectContext();
  const user = useAuthStore(selectUser);
  const studies = useAllStudies(projectId);
  const members = useProjectMembers(projectId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-full gap-0 sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>Assign reviewers</SheetTitle>
          <SheetDescription>
            Two people appraise each study on their own, then reconcile their answers together. Pick
            both reviewers for each study, or let Auto-fill spread the work evenly across the team.
          </SheetDescription>
        </SheetHeader>
        <ReviewerAssignment
          scope={assignSheetScope}
          studies={studies}
          members={members}
          currentUserId={user?.id ?? null}
          onSave={(studyId, slots) => project.study.update(studyId, { ...slots })}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
