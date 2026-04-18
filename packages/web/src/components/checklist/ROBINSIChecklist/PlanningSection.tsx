/**
 * PlanningSection - ROBINS-I planning stage for confounding factors
 */

import { useMemo } from 'react';
import type * as Y from 'yjs';
import { PLANNING_SECTION } from './checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import type { TextRef } from '@/primitives/useProject/checklists';

interface PlanningSectionProps {
  disabled?: boolean;
  getTextRef: (_ref: TextRef) => Y.Text | null;
}

export function PlanningSection({ disabled, getTextRef }: PlanningSectionProps) {
  const p1Field = (PLANNING_SECTION as any).p1;

  const yText = useMemo(
    () =>
      getTextRef({ type: 'ROBINS_I', sectionKey: 'planning', fieldKey: 'confoundingFactors' }),
    [getTextRef],
  );

  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div className='border-warning-border bg-warning-bg border-b px-6 py-4'>
        <h2 className='text-foreground text-lg font-bold'>{(PLANNING_SECTION as any).title}</h2>
        <p className='text-warning-foreground mt-1 text-sm font-medium'>
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
