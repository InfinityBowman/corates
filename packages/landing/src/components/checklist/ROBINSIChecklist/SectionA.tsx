/**
 * SectionA - ROBINS-I Part A: Specify the result being assessed
 */

import { SECTION_A } from './checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';

interface SectionAProps {
  sectionAState: any;
  onUpdate: (_newState: any) => void;
  disabled?: boolean;
  getRobinsText?: (_sectionKey: string, _fieldKey: string) => any;
}

export function SectionA({ disabled, getRobinsText }: SectionAProps) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="border-border bg-muted border-b px-6 py-4">
        <h3 className="text-foreground text-base font-semibold">
          Part A: Specify the Result Being Assessed
        </h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Provide details about the specific result being assessed for risk of bias.
        </p>
      </div>

      <div className="space-y-4 px-6 py-4">
        {Object.entries(SECTION_A as Record<string, any>).map(([key, field]) => (
          <div key={key} className="space-y-2">
            <label className="block">
              <span className="text-secondary-foreground text-sm">
                <span className="font-medium">{field.label}.</span>
                <span className="ml-1">{field.text}</span>
                {field.optional && (
                  <span className="text-muted-foreground/70 ml-1">[optional]</span>
                )}
              </span>
              <div className="mt-2">
                <NoteEditor
                  yText={getRobinsText ? getRobinsText('sectionA', field.stateKey) : null}
                  placeholder={field.placeholder}
                  readOnly={disabled}
                  inline={true}
                />
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
