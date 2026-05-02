import { useMemo } from 'react';
import { PLANNING_SECTION } from './checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import { useProjectReactor } from '@/primitives/useProject/reactor/hooks';
import { resolveYText } from '@/primitives/useProject/reactor/ytext';

interface PlanningSectionProps {
  studyId: string;
  checklistId: string;
  disabled?: boolean;
}

export function PlanningSection({ studyId, checklistId, disabled }: PlanningSectionProps) {
  const p1Field = PLANNING_SECTION.p1;
  const { ydoc } = useProjectReactor();

  const yText = useMemo(
    () => resolveYText(ydoc, studyId, checklistId, 'planning.confoundingFactors'),
    [ydoc, studyId, checklistId],
  );

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
