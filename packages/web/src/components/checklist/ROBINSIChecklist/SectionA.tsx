import { SECTION_A } from './checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import {
  useWorkspaceProjectId,
  useAnswerValue,
  useAnswerWriters,
} from '@/project/workspace-data';

interface SectionAProps {
  studyId: string;
  checklistId: string;
  disabled?: boolean;
}

export function SectionA({ studyId, checklistId, disabled }: SectionAProps) {
  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div className='border-border bg-muted border-b px-6 py-4'>
        <h3 className='text-foreground text-base font-semibold'>
          Part A: Specify the Result Being Assessed
        </h3>
        <p className='text-muted-foreground mt-1 text-xs'>
          Provide details about the specific result being assessed for risk of bias.
        </p>
      </div>

      <div className='flex flex-col gap-4 px-6 py-4'>
        {Object.entries(SECTION_A as Record<string, any>).map(([key, field]) => (
          <SectionAField
            key={key}
            studyId={studyId}
            checklistId={checklistId}
            field={field}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function SectionAField({
  studyId,
  checklistId,
  field,
  disabled,
}: {
  studyId: string;
  checklistId: string;
  field: any;
  disabled?: boolean;
}) {
  const projectId = useWorkspaceProjectId();
  const flatKey = `sectionA.${field.stateKey}`;
  const value = useAnswerValue<string>(projectId, checklistId, flatKey) ?? '';
  const writers = useAnswerWriters(projectId, studyId, checklistId);

  return (
    <div className='flex flex-col gap-2'>
      <label className='block'>
        <span className='text-secondary-foreground text-sm'>
          <span className='font-medium'>{field.label}.</span>
          <span className='ml-1'>{field.text}</span>
          {field.optional && <span className='text-muted-foreground/70 ml-1'>[optional]</span>}
        </span>
        <div className='mt-2'>
          <NoteEditor
            value={value}
            onChange={text => writers.setText(flatKey, text)}
            placeholder={field.placeholder}
            readOnly={disabled}
            inline={true}
          />
        </div>
      </label>
    </div>
  );
}
