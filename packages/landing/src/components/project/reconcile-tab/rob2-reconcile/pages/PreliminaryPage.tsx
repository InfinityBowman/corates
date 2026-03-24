import { useMemo, useEffect, useRef, useId, useCallback } from 'react';
import { useYText } from '@/hooks/useYText';
import { CheckIcon, XIcon, AlertTriangleIcon } from 'lucide-react';
import {
  PRELIMINARY_SECTION,
  STUDY_DESIGNS,
  AIM_OPTIONS,
  DEVIATION_OPTIONS,
  INFORMATION_SOURCES,
} from '@corates/shared/checklists/rob2';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';

const PRELIMINARY_TEXT_FIELDS = ['experimental', 'comparator', 'numericalResult'];

function getPanelBackground(panelType: string): string {
  switch (panelType) {
    case 'reviewer1':
      return 'bg-blue-50/30';
    case 'reviewer2':
      return 'bg-purple-50/30';
    case 'final':
      return 'bg-green-50/30';
    default:
      return '';
  }
}

/**
 * Read-only text display for reviewer panels
 */
function ReadOnlyTextField({ value }: { value: string | null }) {
  return (
    <div className='border-border bg-muted rounded-lg border p-3'>
      <p className='text-secondary-foreground text-sm whitespace-pre-wrap'>
        {value || <span className='text-muted-foreground/70 italic'>Not specified</span>}
      </p>
    </div>
  );
}

/**
 * Pill-style selection buttons (replaces native <select>)
 */
function PillSelectField({
  value,
  options,
  readOnly,
  onChange,
}: {
  value: string | null;
  options: string[];
  readOnly?: boolean;
  onChange?: (_value: string | null) => void;
}) {
  if (readOnly) {
    return (
      <div className='border-border bg-muted rounded-lg border p-3'>
        <p className='text-secondary-foreground text-sm'>
          {value || <span className='text-muted-foreground/70 italic'>Not selected</span>}
        </p>
      </div>
    );
  }

  return (
    <div className='flex flex-wrap gap-2'>
      {options.map(option => {
        const isSelected = value === option;
        return (
          <button
            key={option}
            type='button'
            onClick={() => onChange?.(isSelected ? null : option)}
            className={`rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
              isSelected ?
                'border-green-400 bg-green-50 text-green-800'
              : 'border-border bg-card text-secondary-foreground hover:border-green-300'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Aim selection (radio buttons)
 */
function AimField({
  value,
  readOnly,
  onChange,
}: {
  value: string | null;
  readOnly?: boolean;
  onChange?: (_value: string) => void;
}) {
  const radioGroupName = useId();

  return (
    <div className='flex flex-col gap-2'>
      {Object.entries(AIM_OPTIONS).map(([key, label]) => {
        const isSelected = value === key;

        if (readOnly) {
          return (
            <div
              key={key}
              className={`rounded-lg border-2 p-3 text-sm ${
                isSelected ?
                  'border-blue-400 bg-blue-50 text-blue-800'
                : 'border-border bg-muted text-muted-foreground'
              }`}
            >
              <div className='flex items-center gap-2'>
                {isSelected && <CheckIcon className='size-4' />}
                <span className={isSelected ? 'font-medium' : ''}>{label}</span>
              </div>
            </div>
          );
        }

        return (
          <label
            key={key}
            className={`cursor-pointer rounded-lg border-2 p-3 text-sm transition-all hover:border-green-300 ${
              isSelected ?
                'border-green-400 bg-green-50 text-green-800'
              : 'border-border bg-card text-secondary-foreground'
            }`}
          >
            <input
              type='radio'
              name={radioGroupName}
              value={key}
              checked={isSelected}
              onChange={() => onChange?.(key)}
              className='hidden'
            />
            <div className='flex items-center gap-2'>
              {isSelected && <CheckIcon className='size-4' />}
              <span className={isSelected ? 'font-medium' : ''}>{label}</span>
            </div>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Multi-select checkboxes (deviations, sources)
 */
function MultiSelectField({
  value,
  options,
  readOnly,
  isObject,
  onChange,
}: {
  value: any;
  options: string[];
  readOnly?: boolean;
  isObject?: boolean;
  onChange?: (_value: any) => void;
}) {
  const selected = useMemo(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') {
      return Object.entries(value || {})
        .filter(([, v]) => v)
        .map(([k]) => k);
    }
    return [];
  }, [value]);

  const isSelected = useCallback((option: string) => selected.includes(option), [selected]);

  const handleToggle = useCallback(
    (option: string) => {
      if (readOnly) return;

      if (isObject) {
        const newValue = { ...(value || {}) };
        newValue[option] = !newValue[option];
        onChange?.(newValue);
      } else {
        const current = selected;
        const newValue =
          isSelected(option) ? current.filter((v: string) => v !== option) : [...current, option];
        onChange?.(newValue);
      }
    },
    [readOnly, isObject, value, selected, isSelected, onChange],
  );

  return (
    <div className='flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-2'>
      {options.map(option => {
        const optionSelected = isSelected(option);

        if (readOnly) {
          return (
            <div
              key={option}
              className={`rounded border px-2 py-1.5 text-xs ${
                optionSelected ?
                  'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-border-subtle bg-muted text-muted-foreground/70'
              }`}
            >
              <div className='flex items-center gap-1.5'>
                {optionSelected && <CheckIcon className='size-3 shrink-0' />}
                <span className='line-clamp-2'>{option}</span>
              </div>
            </div>
          );
        }

        return (
          <label
            key={option}
            className={`cursor-pointer rounded border px-2 py-1.5 text-xs transition-all hover:border-green-300 ${
              optionSelected ?
                'border-green-300 bg-green-50 text-green-700'
              : 'border-border bg-card text-secondary-foreground'
            }`}
          >
            <input
              type='checkbox'
              checked={optionSelected}
              onChange={() => handleToggle(option)}
              className='hidden'
            />
            <div className='flex items-center gap-1.5'>
              {optionSelected && <CheckIcon className='size-3 shrink-0' />}
              <span className='line-clamp-2'>{option}</span>
            </div>
          </label>
        );
      })}
    </div>
  );
}

interface PreliminaryPageProps {
  fieldKey: string;
  reviewer1Value: any;
  reviewer2Value: any;
  finalValue: any;
  reviewer1Name: string;
  reviewer2Name: string;
  isAgreement: boolean;
  isAimMismatch: boolean;
  onFinalChange: (_value: any) => void;
  getRob2Text: ((_sectionKey: string, _fieldKey: string) => any) | null;
  onUseReviewer1: () => void;
  onUseReviewer2: () => void;
}

/**
 * Determine the field type from the field key
 */
function getFieldType(fieldKey: string): string {
  if (fieldKey === 'studyDesign') return 'select';
  if (fieldKey === 'aim') return 'aim';
  if (fieldKey === 'deviationsToAddress') return 'multiselect';
  if (fieldKey === 'sources') return 'multiselect-object';
  return 'text';
}

/**
 * Get the available options for a field
 */
function getOptions(fieldKey: string): string[] {
  if (fieldKey === 'studyDesign') return [...STUDY_DESIGNS];
  if (fieldKey === 'deviationsToAddress') return [...DEVIATION_OPTIONS];
  if (fieldKey === 'sources') return [...INFORMATION_SOURCES];
  return [];
}

/**
 * Page for reconciling a preliminary field
 */
export function PreliminaryPage({
  fieldKey,
  reviewer1Value,
  reviewer2Value,
  finalValue,
  reviewer1Name,
  reviewer2Name,
  isAgreement,
  isAimMismatch,
  onFinalChange,
  getRob2Text,
  onUseReviewer1,
  onUseReviewer2,
}: PreliminaryPageProps) {
  const fieldDef = (PRELIMINARY_SECTION as Record<string, any>)[fieldKey];
  const fieldLabel = fieldDef?.label || fieldKey;
  const isTextField = PRELIMINARY_TEXT_FIELDS.includes(fieldKey);

  const preliminaryYText =
    isTextField && getRob2Text ? getRob2Text('preliminary', fieldKey) : null;
  const preliminaryText = useYText(preliminaryYText);

  // Sync Y.Text changes back to finalAnswers so hasNavItemAnswer detects the field as answered
  const onFinalChangeRef = useRef(onFinalChange);
  useEffect(() => {
    onFinalChangeRef.current = onFinalChange;
  });

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!preliminaryYText) return;
    onFinalChangeRef.current(preliminaryText);
  }, [preliminaryText, preliminaryYText]);

  const fieldType = getFieldType(fieldKey);
  const options = useMemo(() => getOptions(fieldKey), [fieldKey]);

  // Render read-only field for reviewer panels
  const renderReadOnlyField = (value: any) => {
    switch (fieldType) {
      case 'select':
        return <PillSelectField value={value} options={options} readOnly={true} />;
      case 'aim':
        return <AimField value={value} readOnly={true} />;
      case 'multiselect':
        return (
          <MultiSelectField value={value} options={options} readOnly={true} isObject={false} />
        );
      case 'multiselect-object':
        return <MultiSelectField value={value} options={options} readOnly={true} isObject={true} />;
      default:
        return <ReadOnlyTextField value={value} />;
    }
  };

  // Render editable field for final panel
  const renderFinalField = () => {
    switch (fieldType) {
      case 'select':
        return <PillSelectField value={finalValue} options={options} onChange={onFinalChange} />;
      case 'aim':
        return <AimField value={finalValue} onChange={onFinalChange} />;
      case 'multiselect':
        return (
          <MultiSelectField
            value={finalValue}
            options={options}
            onChange={onFinalChange}
            isObject={false}
          />
        );
      case 'multiselect-object':
        return (
          <MultiSelectField
            value={finalValue}
            options={options}
            onChange={onFinalChange}
            isObject={true}
          />
        );
      default:
        // Text fields use NoteEditor with Y.Text
        if (isTextField && getRob2Text) {
          return (
            <NoteEditor
              yText={getRob2Text('preliminary', fieldKey)}
              placeholder={fieldDef?.placeholder}
              readOnly={false}
              inline={true}
              focusRingColor='green-500'
            />
          );
        }
        return <ReadOnlyTextField value={finalValue} />;
    }
  };

  return (
    <div className='bg-card rounded-xl shadow-lg'>
      {/* Header */}
      <div
        className={`rounded-t-xl border-b p-4 ${
          isAgreement ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div className='flex items-center gap-2'>
          {isAgreement ?
            <div className='flex size-6 items-center justify-center rounded-full bg-green-500'>
              <CheckIcon className='size-4 text-white' />
            </div>
          : <div className='flex size-6 items-center justify-center rounded-full bg-amber-500'>
              <XIcon className='size-4 text-white' />
            </div>
          }
          <div>
            <h2 className='text-foreground font-semibold'>{fieldLabel}</h2>
            <p className='text-muted-foreground text-sm'>Preliminary Considerations</p>
          </div>
        </div>
      </div>

      {/* Aim Mismatch Warning */}
      {fieldKey === 'aim' && isAimMismatch && (
        <div className='border-destructive/30 bg-destructive/10 mx-4 mt-4 rounded-lg border-2 p-4'>
          <div className='flex items-start gap-3'>
            <AlertTriangleIcon className='text-destructive size-5 shrink-0' />
            <div>
              <h3 className='text-destructive font-semibold'>Cannot Proceed - Aim Mismatch</h3>
              <p className='text-destructive mt-1 text-sm'>
                Reviewers selected different aims. This determines which Domain 2 questions are
                assessed (2a for assignment effect, 2b for adhering effect). You must agree on the
                aim before continuing to domain reconciliation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Three-column comparison */}
      <div className='grid grid-cols-3 divide-x'>
        {/* Reviewer 1 */}
        <div className={`p-4 ${getPanelBackground('reviewer1')}`}>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-foreground font-semibold'>{reviewer1Name || 'Reviewer 1'}</h3>
            <button
              onClick={() => onUseReviewer1?.()}
              className='bg-secondary text-secondary-foreground rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-blue-100 hover:text-blue-700'
            >
              Use This
            </button>
          </div>
          {renderReadOnlyField(reviewer1Value)}
        </div>

        {/* Reviewer 2 */}
        <div className={`p-4 ${getPanelBackground('reviewer2')}`}>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-foreground font-semibold'>{reviewer2Name || 'Reviewer 2'}</h3>
            <button
              onClick={() => onUseReviewer2?.()}
              className='bg-secondary text-secondary-foreground rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-blue-100 hover:text-blue-700'
            >
              Use This
            </button>
          </div>
          {renderReadOnlyField(reviewer2Value)}
        </div>

        {/* Final */}
        <div className={`p-4 ${getPanelBackground('final')}`}>
          <div className='mb-4'>
            <h3 className='text-foreground font-semibold'>Final Answer</h3>
          </div>
          {renderFinalField()}
        </div>
      </div>
    </div>
  );
}
