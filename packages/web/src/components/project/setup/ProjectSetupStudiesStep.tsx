/**
 * Setup step 1 - add the studies to appraise.
 *
 * Hosts AddStudiesForm the way AddStudiesSheet does, including the restore
 * path after a Google Drive OAuth redirect. Studies land in the workspace as
 * they are added; "Continue" submits anything still staged before finishing.
 * Nothing here is required: setup never blocks on having studies.
 */

import { useAddStudies } from '@/hooks/useAddStudies';
import type { MergedStudy } from '@/hooks/useAddStudies/deduplication';
import { useRestoredFormState } from '@/hooks/useRestoredFormState';
import { useAllStudies } from '@/project/workspace-data';
import { project } from '@/project';
import { saveFormState } from '@/lib/formStatePersistence';
import { Button } from '@/components/ui/button';
import { ButtonSpinner } from '@/components/ui/spinner';
import { AddStudiesForm, type AddStudiesFormState } from '../add-studies/AddStudiesForm';
import { useProjectContext } from '../ProjectContext';
import { ProjectSetupStudiesList } from './ProjectSetupStudiesList';

interface ProjectSetupStudiesStepProps {
  onFinish: () => Promise<void>;
  isFinishing: boolean;
}

export function ProjectSetupStudiesStep({ onFinish, isFinishing }: ProjectSetupStudiesStepProps) {
  const { projectId } = useProjectContext();
  const studies = useAllStudies(projectId);
  const addStudies = useAddStudies({});
  const restoredState = useRestoredFormState<AddStudiesFormState>('addStudies', projectId);

  const handleAddStudies = async (studiesToAdd: MergedStudy[]) => {
    await project.study.addBatch(studiesToAdd as unknown as Record<string, unknown>[]);
  };

  const handleContinue = async () => {
    const staged = addStudies.getStudiesToSubmit();
    if (staged.length > 0) {
      await handleAddStudies(staged);
      addStudies.clearAll();
    }
    await onFinish();
  };

  return (
    <div className='flex flex-col gap-8'>
      <div>
        <p className='text-primary text-sm font-medium'>Step 1 of 1</p>
        <h2 className='text-foreground mt-1 text-2xl font-semibold'>Add your studies</h2>
        <p className='text-muted-foreground mt-2 max-w-2xl text-sm'>
          Every paper you appraise is a study. Upload PDFs, import a reference file, look up DOIs or
          PubMed IDs, or pick files from Google Drive. You can always add more from the project
          later.
        </p>
      </div>

      <div className='border-border bg-card rounded-xl border p-6'>
        <AddStudiesForm
          studies={addStudies}
          projectId={projectId}
          formType='addStudies'
          alwaysExpanded
          bare
          initialState={restoredState}
          onSaveState={state => saveFormState('addStudies', state, projectId)}
          onAddStudies={handleAddStudies}
        />
      </div>

      <ProjectSetupStudiesList studies={studies} />

      <div className='border-border flex items-center justify-between gap-4 border-t pt-6'>
        <p className='text-muted-foreground text-sm'>
          Everything is saved as you go. You can add studies from the project at any time.
        </p>
        <Button onClick={handleContinue} disabled={isFinishing}>
          {isFinishing && <ButtonSpinner />}
          Continue to project
        </Button>
      </div>
    </div>
  );
}
