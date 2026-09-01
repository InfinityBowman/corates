/**
 * ProjectSetupView - Full-viewport first-run setup for new projects.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectSetupStep } from '@corates/shared';
import { useProjectMeta, useAllStudies } from '@/project/workspace-data';
import { useProjectOrgId } from '@/hooks/useProjectOrgId';
import { ProjectGate } from '@/project';
import { PageLoader, Spinner } from '@/components/ui/spinner';
import { queryKeys } from '@/lib/queryKeys';
import { getInvitations, updateProjectSetup } from '@/server/functions/org-projects.functions';
import { ProjectSetupStepRail } from './ProjectSetupStepRail';
import { ProjectSetupStudiesStep } from './ProjectSetupStudiesStep';
import { ProjectSetupTeamStep } from './ProjectSetupTeamStep';
import { ProjectSetupStepFooter } from './ProjectSetupStepFooter';
import { ProjectSetupStepHeader } from './ProjectSetupStepHeader';
import { getPreviousSetupStep, setupStepNumber, SETUP_STEPS } from './setup-steps';

interface ProjectSetupViewProps {
  projectId: string;
}

export function ProjectSetupView({ projectId }: ProjectSetupViewProps) {
  return (
    <ProjectGate projectId={projectId} fallback={<PageLoader label='Loading project setup...' />}>
      <ProjectSetupViewInner projectId={projectId} />
    </ProjectGate>
  );
}

function ProjectSetupViewInner({ projectId }: ProjectSetupViewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meta = useProjectMeta(projectId);
  const orgId = useProjectOrgId(projectId);
  const studies = useAllStudies(projectId);
  const [isNavigating, setIsNavigating] = useState(false);

  const currentStep: ProjectSetupStep = meta.setupStep ?? 'studies';
  const setupSkipInvites = meta.setupSkipInvites;

  const invitesQuery = useQuery({
    queryKey: queryKeys.projects.setupInvites(projectId),
    queryFn: () => getInvitations({ data: { orgId: orgId!, projectId } }),
    enabled: Boolean(orgId) && currentStep !== 'studies',
  });
  const inviteCount = invitesQuery.data?.length ?? 0;

  // Only owners run setup, and only while it is in progress; everyone else lands on the project.
  const shouldLeave =
    meta.name !== null && (meta.role !== 'owner' || meta.setupStatus !== 'in_progress');

  const goToProject = () => navigate({ to: '/projects/$projectId', params: { projectId } });

  useEffect(() => {
    if (shouldLeave) goToProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLeave]);

  // The setup-invites key sits under projects.all, so one invalidation covers both.
  const handleStepComplete = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

  const goToSetupStep = async (step: ProjectSetupStep) => {
    if (!orgId || step === currentStep) return;
    setIsNavigating(true);
    try {
      await updateProjectSetup({ data: { orgId, projectId, setupStep: step } });
      await handleStepComplete();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could Not Change Step' });
    } finally {
      setIsNavigating(false);
    }
  };

  const goToPreviousStep = () => {
    const previous = getPreviousSetupStep(currentStep);
    if (previous) void goToSetupStep(previous);
  };

  if (!meta.name || !orgId) {
    return <PageLoader label='Loading project setup...' />;
  }

  if (shouldLeave) {
    return null;
  }

  return (
    <div className='bg-background flex min-h-full flex-col'>
      <div className='border-border bg-card flex items-center justify-between border-b px-5 py-3'>
        <div className='flex items-center gap-2.5'>
          <span className='text-foreground text-sm font-bold'>CoRATES</span>
          <span className='bg-primary/10 text-primary rounded-full px-2.5 py-1 text-[11px] font-semibold'>
            Setting up {meta.name}
          </span>
        </div>
        <button
          type='button'
          onClick={goToProject}
          className='text-muted-foreground hover:text-foreground text-sm font-medium'
        >
          Finish later
        </button>
      </div>

      <div className='flex min-h-0 flex-1'>
        <ProjectSetupStepRail
          currentStep={currentStep}
          studyCount={studies.length}
          inviteCount={inviteCount}
          setupSkipInvites={setupSkipInvites}
          onStepSelect={step => void goToSetupStep(step)}
          isNavigating={isNavigating}
        />

        <div className='flex min-w-0 flex-1 flex-col'>
          {currentStep === 'studies' && (
            <ProjectSetupStudiesStep
              studies={studies}
              setupSkipInvites={setupSkipInvites}
              orgId={orgId}
              onStepComplete={handleStepComplete}
            />
          )}
          {currentStep === 'team' &&
            (invitesQuery.data ?
              <ProjectSetupTeamStep
                orgId={orgId}
                initialInvites={invitesQuery.data}
                onStepComplete={handleStepComplete}
                onBack={goToPreviousStep}
                isNavigating={isNavigating}
              />
            : <div className='flex flex-1 items-center justify-center p-10'>
                <Spinner label='Loading invites...' />
              </div>)}
          {currentStep === 'distribution' && (
            <div className='flex min-h-0 flex-1 flex-col px-10 py-8'>
              <ProjectSetupStepHeader step='distribution' title='Share the studies out'>
                Distribution (Phase 5)
              </ProjectSetupStepHeader>
              <ProjectSetupStepFooter
                hint='You can rebalance any time'
                backLabel='Back to your team'
                onBack={goToPreviousStep}
                backDisabled={isNavigating}
              />
            </div>
          )}
        </div>
      </div>

      <div className='sr-only' aria-live='polite'>
        Project setup step {setupStepNumber(currentStep)} of {SETUP_STEPS.length}
      </div>
    </div>
  );
}
