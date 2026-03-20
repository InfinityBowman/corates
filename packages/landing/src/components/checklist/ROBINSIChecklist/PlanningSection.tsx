/**
 * PlanningSection - ROBINS-I planning stage for confounding factors
 */

import { useMemo } from 'react';
import { PLANNING_SECTION } from './checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';

interface PlanningSectionProps {
  disabled?: boolean;
  getRobinsText?: (_sectionKey: string, _fieldKey: string) => any;
}

export function PlanningSection({ disabled, getRobinsText }: PlanningSectionProps) {
  const p1Field = (PLANNING_SECTION as any).p1;

  const yText = useMemo(
    () => (getRobinsText ? getRobinsText('planning', 'confoundingFactors') : null),
    [getRobinsText],
  );

  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div className='border-b border-warning-border bg-warning-bg px-6 py-4'>
        <h2 className='text-foreground text-lg font-bold'>{(PLANNING_SECTION as any).title}</h2>
        <p className='mt-1 text-sm font-medium text-warning-foreground'>
          {(PLANNING_SECTION as any).subtitle}
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
                yText={yText}
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
