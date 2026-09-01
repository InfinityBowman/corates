/**
 * Step 1 - import studies before advancing.
 */

import { useState } from 'react';
import { AddStudiesForm, type AddStudiesFormState } from '../add-studies/AddStudiesForm';
import type { MergedStudy } from '@/hooks/useAddStudies/deduplication';
import { useAddStudies } from '@/hooks/useAddStudies';
import { useRestoredFormState } from '@/hooks/useRestoredFormState';
import { project } from '@/project';
import type { StudyInfo } from '@/stores/projectStore';
import { useProjectContext } from '../ProjectContext';
import { updateProjectSetup } from '@/server/functions/org-projects.functions';
import { saveFormState } from '@/lib/formStatePersistence.js';
import { ProjectSetupStepFooter } from './ProjectSetupStepFooter';
import { ProjectSetupStepHeader } from './ProjectSetupStepHeader';
import { ProjectSetupStudiesList } from './ProjectSetupStudiesList';

interface ProjectSetupStudiesStepProps {
  studies: StudyInfo[];
  setupSkipInvites: boolean;
  orgId: string;
  onStepComplete: () => void;
}

export function ProjectSetupStudiesStep({
  studies,
  setupSkipInvites,
  orgId,
  onStepComplete,
}: ProjectSetupStudiesStepProps) {
  const { projectId } = useProjectContext();
  const addStudies = useAddStudies({});
  const [restoredState] = useRestoredFormState<AddStudiesFormState>('createProject', projectId);
  const [isContinuing, setIsContinuing] = useState(false);

  const canContinue = studies.length > 0 || addStudies.totalStudyCount > 0;

  const handleAddStudies = async (studiesToAdd: MergedStudy[]) => {
    await project.study.addBatch(studiesToAdd as unknown as Record<string, unknown>[]);
  };

  const handleContinue = async () => {
    setIsContinuing(true);
    try {
      const staged = addStudies.getStudiesToSubmit();
      if (staged.length > 0) {
        await handleAddStudies(staged);
        addStudies.clearAll();
      }
      await updateProjectSetup({
        data: { orgId, projectId, setupStep: setupSkipInvites ? 'distribution' : 'team' },
      });
      onStepComplete();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Could Not Continue' });
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <div className='flex min-h-0 flex-1 flex-col px-10 py-8'>
      <ProjectSetupStepHeader step='studies' title="Add the studies you're appraising">
        Bring in everything that made it through screening. Titles, authors and years are pulled
        automatically. You can always add more later.
      </ProjectSetupStepHeader>

      <div className='mt-6 min-h-0 flex-1 overflow-y-auto pr-1'>
        <AddStudiesForm
          studies={addStudies}
          projectId={projectId}
          formType='createProject'
          alwaysExpanded
          bare
          initialState={restoredState}
          onSaveState={state => saveFormState('createProject', state, projectId)}
          onAddStudies={handleAddStudies}
        />
        <ProjectSetupStudiesList studies={studies} />
      </div>

      <ProjectSetupStepFooter
        hint='Everything is saved as you go'
        primaryLabel={setupSkipInvites ? 'Continue' : 'Continue to your team'}
        onPrimary={handleContinue}
        primaryDisabled={!canContinue}
        isLoading={isContinuing}
      />
    </div>
  );
}
