/**
 * SectionC - ROBINS-I Part C: Specify the (hypothetical) target randomized trial
 * Includes the isPerProtocol toggle that controls which Domain 1 variant is shown.
 */

import { useMemo, useCallback, useId } from 'react';
import type * as Y from 'yjs';
import { SECTION_C } from './checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import type { TextRef } from '@/primitives/useProject/checklists';

interface SectionCState {
  isPerProtocol?: boolean;
  [key: string]: unknown;
}

interface SectionCProps {
  sectionCState: SectionCState | undefined;
  onUpdate: (_newState: SectionCState) => void;
  disabled?: boolean;
  getTextRef: (_ref: TextRef) => Y.Text | null;
}

export function SectionC({ sectionCState, onUpdate, disabled, getTextRef }: SectionCProps) {
  const uniqueId = useId();
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

  const handleProtocolToggle = useCallback(
    (value: boolean) => {
      onUpdate({ ...sectionCState, isPerProtocol: value });
    },
    [sectionCState, onUpdate],
  );

  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div className='border-border bg-muted border-b px-6 py-4'>
        <h3 className='text-foreground text-base font-semibold'>
          Part C: Specify the (Hypothetical) Target Randomized Trial
        </h3>
        <p className='text-muted-foreground mt-1 text-xs'>{SECTION_C.description}</p>
      </div>

      <div className='flex flex-col gap-4 px-6 py-4'>
        {/* Text fields: C1, C2, C3 */}
        {textFields.map(([key, field]) => (
          <div key={key} className='flex flex-col gap-2'>
            <label className='block'>
              <span className='text-secondary-foreground text-sm'>
                <span className='font-medium'>{field.label}.</span>
                <span className='ml-1'>{field.text}</span>
              </span>
              <div className='mt-2'>
                <NoteEditor
                  yText={getTextRef({
                    type: 'ROBINS_I',
                    sectionKey: 'sectionC',
                    fieldKey: field.stateKey,
                  })}
                  placeholder={field.placeholder}
                  readOnly={disabled}
                  inline={true}
                />
              </div>
            </label>
          </div>
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
                  sectionCState?.isPerProtocol === option.value ?
                    'border-blue-500 bg-blue-50'
                  : 'border-border bg-card hover:border-border'
                } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type='radio'
                  name={`protocol-type-c4-${uniqueId}`}
                  checked={sectionCState?.isPerProtocol === option.value}
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
