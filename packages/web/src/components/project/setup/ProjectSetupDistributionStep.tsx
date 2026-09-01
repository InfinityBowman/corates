/**
 * Step 3 - share the studies out across the people who have joined.
 *
 * Invitees are not members until they accept, so with only the owner here every
 * study goes to them for now; with two or more members the bulk
 * ReviewerAssignment flow takes over.
 */

import { useState } from 'react';
import { CheckIcon, UserIcon } from 'lucide-react';
import type { MemberEntry, StudyInfo } from '@/stores/projectStore';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { project } from '@/project';
import { updateProjectSetup } from '@/server/functions/org-projects.functions';
import { useProjectContext } from '../ProjectContext';
import { ReviewerAssignment } from '../assign-reviewers/ReviewerAssignment';
import { ProjectSetupStepFooter } from './ProjectSetupStepFooter';
import { ProjectSetupStepHeader } from './ProjectSetupStepHeader';

interface ProjectSetupDistributionStepProps {
  orgId: string;
  studies: StudyInfo[];
  members: MemberEntry[];
  onFinished: () => void;
  onBack: () => void;
  backLabel: string;
  isNavigating: boolean;
}

export function ProjectSetupDistributionStep({
  orgId,
  studies,
  members,
  onFinished,
  onBack,
  backLabel,
  isNavigating,
}: ProjectSetupDistributionStepProps) {
  const { projectId } = useProjectContext();
  const currentUser = useAuthStore(selectUser);
  const [isFinishing, setIsFinishing] = useState(false);

  const unassigned = studies.filter(s => !s.reviewer1 && !s.reviewer2);
  const allAssigned = studies.length > 0 && unassigned.length === 0;
  const onlyMe = members.length < 2;

  const assignReviewers = (studyId: string, updates: Record<string, unknown>) => {
    project.study.update(studyId, updates);
  };

  const assignAllToMe = () => {
    if (!currentUser) return;
    for (const study of unassigned) {
      assignReviewers(study.id, { reviewer1: currentUser.id, reviewer2: null });
    }
  };

  // TODO(agent): Phase 6 replaces this with the completion screen and sends the
  // drafted invitations; for now finishing just closes the wizard.
  const finishSetup = async () => {
    setIsFinishing(true);
    try {
      await updateProjectSetup({
        data: { orgId, projectId, setupStatus: 'completed', setupStep: null },
      });
      onFinished();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could Not Finish Setup' });
    } finally {
      setIsFinishing(false);
    }
  };

  const studyWord = (count: number) => (count === 1 ? 'study' : 'studies');

  return (
    <div className='flex min-h-0 flex-1 flex-col px-10 py-8'>
      <ProjectSetupStepHeader step='distribution' title='Share the studies out'>
        {onlyMe ?
          "It's just you for now. Take every study to get started; once your team joins you can add second reviewers or rebalance from the project."
        : 'Each study goes to two reviewers. You can rebalance later from the project.'}
      </ProjectSetupStepHeader>

      <div className='mt-6 min-h-0 max-w-2xl flex-1 overflow-y-auto pr-1'>
        {onlyMe ?
          allAssigned ?
            <div className='text-success flex items-center gap-2'>
              <CheckIcon className='size-5' />
              <p className='text-sm'>
                All {studies.length} {studyWord(studies.length)} are assigned to you.
              </p>
            </div>
          : <div className='border-border bg-card flex items-center justify-between gap-4 rounded-xl border p-4'>
              <div className='flex items-center gap-3'>
                <div className='bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full'>
                  <UserIcon className='size-4' />
                </div>
                <div>
                  <p className='text-foreground text-sm font-semibold'>
                    {unassigned.length} {studyWord(unassigned.length)} to assign
                  </p>
                  <p className='text-muted-foreground text-xs'>You are the only reviewer so far</p>
                </div>
              </div>
              <Button onClick={assignAllToMe} disabled={!currentUser}>
                Assign all to me
              </Button>
            </div>

        : <ReviewerAssignment
            studies={studies}
            members={members}
            onAssignReviewers={assignReviewers}
          />
        }
      </div>

      <ProjectSetupStepFooter
        hint={allAssigned ? 'Everything is assigned' : 'Assign every study to finish setup'}
        backLabel={backLabel}
        onBack={onBack}
        backDisabled={isNavigating || isFinishing}
        primaryLabel='Finish setup'
        onPrimary={() => void finishSetup()}
        primaryDisabled={!allAssigned || isNavigating}
        isLoading={isFinishing}
      />
    </div>
  );
}
