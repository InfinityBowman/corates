import { useMemo } from 'react';
import { SECTION_A } from './checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import { useProjectReactor } from '@/primitives/useProject/reactor/hooks';
import { resolveYText } from '@/primitives/useProject/reactor/ytext';

interface SectionAProps {
  studyId: string;
  checklistId: string;
  disabled?: boolean;
}

export function SectionA({ studyId, checklistId, disabled }: SectionAProps) {
  const { ydoc } = useProjectReactor();

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
            ydoc={ydoc}
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
  ydoc,
  studyId,
  checklistId,
  field,
  disabled,
}: {
  ydoc: any;
  studyId: string;
  checklistId: string;
  field: any;
  disabled?: boolean;
}) {
  const yText = useMemo(
    () => resolveYText(ydoc, studyId, checklistId, `sectionA.${field.stateKey}`),
    [ydoc, studyId, checklistId, field.stateKey],
  );

  return (
    <div className='flex flex-col gap-2'>
      <label className='block'>
        <span className='text-secondary-foreground text-sm'>
          <span className='font-medium'>{field.label}.</span>
          <span className='ml-1'>{field.text}</span>
          {field.optional && (
            <span className='text-muted-foreground/70 ml-1'>[optional]</span>
          )}
        </span>
        <div className='mt-2'>
          <NoteEditor
            yText={yText}
            placeholder={field.placeholder}
            readOnly={disabled}
            inline={true}
          />
        </div>
      </label>
    </div>
  );
}
