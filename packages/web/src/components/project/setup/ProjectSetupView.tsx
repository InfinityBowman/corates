/**
 * ProjectSetupView - Full-page first-run setup for a new project.
 *
 * Owner-only while the project row still carries a setupStep; everyone else,
 * and any finished project, is sent to the project view.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectMeta } from '@/project/workspace-data';
import { ProjectGate } from '@/project';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { queryKeys } from '@/lib/queryKeys';
import { updateProjectSetupStep } from '@/server/functions/org-projects.functions';
import { ProjectSetupStudiesStep } from './ProjectSetupStudiesStep';

interface ProjectSetupViewProps {
  projectId: string;
}

export function ProjectSetupView({ projectId }: ProjectSetupViewProps) {
  return (
    <ProjectGate
      projectId={projectId}
      fallback={<PageLoader className='min-h-full' label='Loading project setup...' />}
    >
      <ProjectSetupViewInner projectId={projectId} />
    </ProjectGate>
  );
}

function ProjectSetupViewInner({ projectId }: ProjectSetupViewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meta = useProjectMeta(projectId);
  const [isFinishing, setIsFinishing] = useState(false);

  const goToProject = () => navigate({ to: '/projects/$projectId', params: { projectId } });

  const shouldLeave = meta.name !== null && (meta.role !== 'owner' || meta.setupStep === null);

  useEffect(() => {
    if (shouldLeave) void goToProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLeave]);

  const finishSetup = async () => {
    if (!meta.orgId) return;
    setIsFinishing(true);
    try {
      await updateProjectSetupStep({ data: { orgId: meta.orgId, projectId, setupStep: null } });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      void goToProject();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could not finish setup' });
      setIsFinishing(false);
    }
  };

  if (meta.name === null || !meta.orgId || shouldLeave) {
    return <PageLoader className='min-h-full' label='Loading project setup...' />;
  }

  return (
    <div className='bg-background flex min-h-full flex-col'>
      <header className='border-border bg-card sticky top-0 z-20 border-b'>
        <div className='mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4'>
          <div className='min-w-0'>
            <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
              Setting up
            </p>
            <h1 className='text-foreground truncate text-lg font-semibold'>{meta.name}</h1>
          </div>
          <Button variant='ghost' onClick={goToProject} disabled={isFinishing}>
            Finish later
          </Button>
        </div>
      </header>

      <div className='mx-auto w-full max-w-4xl flex-1 px-6 py-8'>
        <ProjectSetupStudiesStep onFinish={finishSetup} isFinishing={isFinishing} />
      </div>
    </div>
  );
}
