import { useMemo, useId } from 'react';
import { SECTION_C } from '@corates/shared/checklists/robins-i';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import { useWorkspaceProjectId, useAnswerValue, useAnswerWriters } from '@/project/workspace-data';

interface SectionCProps {
  studyId: string;
  checklistId: string;
  disabled?: boolean;
}

export function SectionC({ studyId, checklistId, disabled }: SectionCProps) {
  const uniqueId = useId();
  const projectId = useWorkspaceProjectId();
  const writers = useAnswerWriters(projectId, studyId, checklistId);
  const isPerProtocol = useAnswerValue<boolean>(projectId, checklistId, 'sectionC.isPerProtocol');

  const textFields = useMemo(
    () =>
      Object.entries(SECTION_C).filter(
        ([, field]) =>
          typeof field === 'object' &&
          field !== null &&
          'type' in field &&
          field.type === 'textarea',
      ) as [
        string,
        { label: string; text: string; placeholder: string; stateKey: string; type: string },
      ][],
    [],
  );

  const c4Field = SECTION_C.c4;

  const handleProtocolToggle = (value: boolean) => {
    writers.updateAnswer({ type: 'ROBINS_I', key: 'sectionC', data: { isPerProtocol: value } });
  };

  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div className='border-border bg-muted border-b px-6 py-4'>
        <h3 className='text-foreground text-base font-semibold'>
          Part C: Specify the (Hypothetical) Target Randomized Trial
        </h3>
        <p className='text-muted-foreground mt-1 text-xs'>{SECTION_C.description}</p>
      </div>

      <div className='flex flex-col gap-4 px-6 py-4'>
        {textFields.map(([key, field]) => (
          <SectionCTextField
            key={key}
            studyId={studyId}
            checklistId={checklistId}
            field={field}
            disabled={disabled}
          />
        ))}

        {/* C4: Protocol type radio */}
        <div className='border-border flex flex-col gap-2 border-t pt-2'>
          <div className='text-secondary-foreground text-sm'>
            <span className='font-medium'>{c4Field.label}.</span>
            <span className='ml-1'>{c4Field.text}</span>
          </div>
          <div className='mt-2 flex flex-col gap-2'>
            {c4Field.options.map(option => (
              <label
                key={option.label}
                className={`flex items-center gap-3 rounded-lg border-2 p-3 transition-all duration-200 ${
                  isPerProtocol === option.value ?
                    'border-blue-500 bg-blue-50'
                  : 'border-border bg-card hover:border-border'
                } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type='radio'
                  name={`protocol-type-c4-${uniqueId}`}
                  checked={isPerProtocol === option.value}
                  disabled={disabled}
                  onChange={() => !disabled && handleProtocolToggle(option.value)}
                  className='size-4 text-blue-600'
                />
                <span className='text-secondary-foreground text-sm'>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCTextField({
  studyId,
  checklistId,
  field,
  disabled,
}: {
  studyId: string;
  checklistId: string;
  field: { label: string; text: string; placeholder: string; stateKey: string };
  disabled?: boolean;
}) {
  const projectId = useWorkspaceProjectId();
  const flatKey = `sectionC.${field.stateKey}`;
  const value = useAnswerValue<string>(projectId, checklistId, flatKey) ?? '';
  const writers = useAnswerWriters(projectId, studyId, checklistId);

  return (
    <div className='flex flex-col gap-2'>
      <label className='block'>
        <span className='text-secondary-foreground text-sm'>
          <span className='font-medium'>{field.label}.</span>
          <span className='ml-1'>{field.text}</span>
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
