/**
 * ProjectSheets - the Add studies, Assign reviewers and Outcomes sheets,
 * mounted once per project view. Anything can open them through the
 * project context; the header only triggers them.
 */

import { toast } from 'sonner';
import { useProjectMembers } from '@/project/workspace-data';
import { AddStudiesSheet } from './add-studies/AddStudiesSheet';
import { AssignReviewersSheet } from './assign-reviewers/AssignReviewersSheet';
import { OutcomesSheet } from './outcomes/OutcomesSheet';
import { useProjectContext } from './ProjectContext';

export function ProjectSheets() {
  const {
    projectId,
    isOwner,
    addStudiesSheetOpen,
    setAddStudiesSheetOpen,
    assignSheetOpen,
    setAssignSheetOpen,
    openAssignSheet,
    outcomesSheetOpen,
    setOutcomesSheetOpen,
  } = useProjectContext();
  const members = useProjectMembers(projectId);

  // addBatch shows its own result toast; this one hands off just the new studies.
  function handleAdded(studyIds: string[]) {
    if (!isOwner || members.length < 2 || studyIds.length === 0) return;
    const count = studyIds.length;
    const label = `${count} new ${count === 1 ? 'study' : 'studies'}`;
    toast('Assign reviewers?', {
      description: `The ${label} ${count === 1 ? 'has' : 'have'} no reviewers yet.`,
      duration: 10000,
      action: {
        label: 'Assign reviewers',
        onClick: () => openAssignSheet({ studyIds, label }),
      },
    });
  }

  return (
    <>
      <AddStudiesSheet
        open={addStudiesSheetOpen}
        onOpenChange={setAddStudiesSheetOpen}
        onAdded={handleAdded}
      />
      {isOwner && <AssignReviewersSheet open={assignSheetOpen} onOpenChange={setAssignSheetOpen} />}
      <OutcomesSheet open={outcomesSheetOpen} onOpenChange={setOutcomesSheetOpen} />
    </>
  );
}
