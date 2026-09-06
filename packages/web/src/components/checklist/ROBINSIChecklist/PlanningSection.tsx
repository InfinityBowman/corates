import { PLANNING_SECTION } from '@corates/shared/checklists/robins-i';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import { useWorkspaceProjectId, useAnswerValue, useAnswerWriters } from '@/project/workspace-data';

interface PlanningSectionProps {
  studyId: string;
  checklistId: string;
  disabled?: boolean;
}

export function PlanningSection({ studyId, checklistId, disabled }: PlanningSectionProps) {
  const p1Field = PLANNING_SECTION.p1;
  const projectId = useWorkspaceProjectId();
  const value = useAnswerValue<string>(projectId, checklistId, 'planning.confoundingFactors') ?? '';
  const writers = useAnswerWriters(projectId, studyId, checklistId);

  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div className='border-warning-border bg-warning-bg border-b px-6 py-4'>
        <h2 className='text-foreground text-lg font-bold'>{PLANNING_SECTION.title}</h2>
        <p className='text-warning-foreground mt-1 text-sm font-medium'>
          {PLANNING_SECTION.subtitle}
        </p>
      </div>

      <div className='px-6 py-4'>
        <div className='flex flex-col gap-2'>
          <label className='block'>
            <span className='text-secondary-foreground text-sm'>
              <span className='font-medium'>{p1Field.label}.</span>
              <span className='ml-1'>{p1Field.text}</span>
            </span>
            <div className='mt-2'>
              <NoteEditor
                value={value}
                onChange={text => writers.setText('planning.confoundingFactors', text)}
                placeholder={p1Field.placeholder}
                readOnly={disabled}
                inline={true}
              />
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
