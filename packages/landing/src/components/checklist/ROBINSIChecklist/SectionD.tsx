/**
 * SectionD - ROBINS-I: Information sources
 */

import { useCallback, useMemo } from 'react';
import { INFORMATION_SOURCES, SECTION_D } from './checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';

interface SectionDProps {
  sectionDState: any;
  onUpdate: (_newState: any) => void;
  disabled?: boolean;
  getRobinsText?: (_sectionKey: string, _fieldKey: string) => any;
}

export function SectionD({ sectionDState, onUpdate, disabled, getRobinsText }: SectionDProps) {
  const handleSourceToggle = useCallback(
    (sourceName: string) => {
      const newSources = {
        ...sectionDState?.sources,
        [sourceName]: !sectionDState?.sources?.[sourceName],
      };
      onUpdate({ ...sectionDState, sources: newSources });
    },
    [sectionDState, onUpdate],
  );

  const otherSpecifyYText = useMemo(
    () => (getRobinsText ? getRobinsText('sectionD', 'otherSpecify') : null),
    [getRobinsText],
  );

  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div className='border-border bg-muted border-b px-6 py-4'>
        <h3 className='text-foreground text-base font-semibold'>{(SECTION_D as any).title}</h3>
        <p className='text-muted-foreground mt-1 text-xs'>{(SECTION_D as any).description}</p>
      </div>

      <div className='space-y-3 px-6 py-4'>
        <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
          {INFORMATION_SOURCES.map(source => {
            const isChecked = sectionDState?.sources?.[source] || false;
            return (
              <label
                key={source}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-all duration-200 ${
                  isChecked ?
                    'border-blue-500 bg-blue-50'
                  : 'border-border bg-card hover:border-border'
                } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type='checkbox'
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => !disabled && handleSourceToggle(source)}
                  className='border-border focus:ring-primary mt-0.5 h-4 w-4 rounded text-blue-600'
                />
                <span className='text-secondary-foreground text-sm'>{source}</span>
              </label>
            );
          })}
        </div>

        <div className='border-border border-t pt-3'>
          <label className='block'>
            <span className='text-secondary-foreground text-sm font-medium'>
              {(SECTION_D as any).otherField.label}
            </span>
            <div className='mt-2'>
              <NoteEditor
                yText={otherSpecifyYText}
                placeholder={(SECTION_D as any).otherField.placeholder}
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
