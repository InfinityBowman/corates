/**
 * PreliminarySection - Preliminary considerations for ROB-2
 * Study design, interventions, numerical result, aim selection, deviations, information sources
 */

import { useMemo, useCallback } from 'react';
import {
  PRELIMINARY_SECTION,
  STUDY_DESIGNS,
  AIM_OPTIONS,
  DEVIATION_OPTIONS,
  INFORMATION_SOURCES,
} from './checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';

interface PreliminarySectionProps {
  preliminaryState: any;
  onUpdate: (_newState: any) => void;
  disabled?: boolean;
  getRob2Text?: (_sectionKey: string, _fieldKey: string, _questionKey?: string) => any;
}

export function PreliminarySection({
  preliminaryState,
  onUpdate,
  disabled,
  getRob2Text,
}: PreliminarySectionProps) {
  const handleStudyDesignChange = useCallback(
    (value: string) => {
      onUpdate({ ...preliminaryState, studyDesign: value });
    },
    [preliminaryState, onUpdate],
  );

  const handleAimChange = useCallback(
    (aim: string) => {
      onUpdate({ ...preliminaryState, aim: preliminaryState?.aim === aim ? null : aim });
    },
    [preliminaryState, onUpdate],
  );

  const handleDeviationToggle = useCallback(
    (deviation: string) => {
      const current = preliminaryState?.deviationsToAddress || [];
      const updated = current.includes(deviation)
        ? current.filter((d: string) => d !== deviation)
        : [...current, deviation];
      onUpdate({ ...preliminaryState, deviationsToAddress: updated });
    },
    [preliminaryState, onUpdate],
  );

  const handleSourceToggle = useCallback(
    (source: string) => {
      const current = preliminaryState?.sources || {};
      onUpdate({ ...preliminaryState, sources: { ...current, [source]: !current[source] } });
    },
    [preliminaryState, onUpdate],
  );

  const experimentalYText = useMemo(
    () => getRob2Text?.('preliminary', 'experimental') ?? null,
    [getRob2Text],
  );
  const comparatorYText = useMemo(
    () => getRob2Text?.('preliminary', 'comparator') ?? null,
    [getRob2Text],
  );
  const numericalResultYText = useMemo(
    () => getRob2Text?.('preliminary', 'numericalResult') ?? null,
    [getRob2Text],
  );

  return (
    <div className="bg-card overflow-hidden rounded-lg shadow-md">
      <div className="bg-blue-600 px-6 py-4 text-white">
        <h2 className="text-lg font-semibold">Preliminary Considerations</h2>
        <p className="mt-1 text-sm text-blue-100">
          Complete these sections before assessing the domains
        </p>
      </div>

      <div className="space-y-6 px-6 py-5">
        {/* Study Design */}
        <div>
          <label className="text-secondary-foreground mb-2 block text-sm font-medium">
            {(PRELIMINARY_SECTION as any).studyDesign.label}
          </label>
          <div className="flex flex-wrap gap-2">
            {STUDY_DESIGNS.map(design => (
              <button
                key={design}
                type="button"
                onClick={() => !disabled && handleStudyDesignChange(design)}
                disabled={disabled}
                className={`rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                } ${
                  preliminaryState?.studyDesign === design
                    ? 'border-blue-400 bg-blue-50 text-blue-800'
                    : 'border-border bg-card text-muted-foreground hover:border-border'
                }`}
              >
                {design}
              </button>
            ))}
          </div>
        </div>

        {/* Interventions */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-secondary-foreground mb-2 block text-sm font-medium">
              {(PRELIMINARY_SECTION as any).experimental.label}
            </label>
            <NoteEditor
              yText={experimentalYText}
              placeholder={(PRELIMINARY_SECTION as any).experimental.placeholder}
              readOnly={disabled}
              inline={true}
            />
          </div>
          <div>
            <label className="text-secondary-foreground mb-2 block text-sm font-medium">
              {(PRELIMINARY_SECTION as any).comparator.label}
            </label>
            <NoteEditor
              yText={comparatorYText}
              placeholder={(PRELIMINARY_SECTION as any).comparator.placeholder}
              readOnly={disabled}
              inline={true}
            />
          </div>
        </div>

        {/* Numerical Result */}
        <div>
          <label className="text-secondary-foreground mb-2 block text-sm font-medium">
            {(PRELIMINARY_SECTION as any).numericalResult.label}
          </label>
          <NoteEditor
            yText={numericalResultYText}
            placeholder={(PRELIMINARY_SECTION as any).numericalResult.placeholder}
            readOnly={disabled}
            inline={true}
          />
        </div>

        {/* Aim Selection */}
        <div>
          <label className="text-secondary-foreground mb-2 block text-sm font-medium">
            {(PRELIMINARY_SECTION as any).aim.label}
          </label>
          <div className="space-y-2">
            {(['ASSIGNMENT', 'ADHERING'] as const).map(aim => (
              <button
                key={aim}
                type="button"
                onClick={() => !disabled && handleAimChange(aim)}
                disabled={disabled}
                className={`flex w-full items-start rounded-lg border-2 p-3 text-left text-sm transition-colors ${
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                } ${
                  preliminaryState?.aim === aim
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-border bg-card hover:border-border'
                }`}
              >
                <div className="mt-0.5 mr-3">
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                      preliminaryState?.aim === aim ? 'border-blue-500 bg-blue-500' : 'border-border'
                    }`}
                  >
                    {preliminaryState?.aim === aim && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <span className="text-secondary-foreground">{(AIM_OPTIONS as any)[aim]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Deviations to Address (only for ADHERING) */}
        {preliminaryState?.aim === 'ADHERING' && (
          <div>
            <label className="text-secondary-foreground mb-2 block text-sm font-medium">
              {(PRELIMINARY_SECTION as any).deviationsToAddress.label}
            </label>
            <p className="text-muted-foreground mb-3 text-xs">
              {(PRELIMINARY_SECTION as any).deviationsToAddress.info}
            </p>
            <div className="space-y-2">
              {DEVIATION_OPTIONS.map(deviation => {
                const isChecked = (preliminaryState?.deviationsToAddress || []).includes(deviation);
                return (
                  <button
                    key={deviation}
                    type="button"
                    onClick={() => !disabled && handleDeviationToggle(deviation)}
                    disabled={disabled}
                    className={`flex w-full items-center rounded-lg border p-3 text-left text-sm transition-colors ${
                      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    } ${isChecked ? 'border-blue-300 bg-blue-50' : 'border-border bg-card hover:border-border'}`}
                  >
                    <div
                      className={`mr-3 flex h-4 w-4 items-center justify-center rounded border ${
                        isChecked ? 'border-blue-500 bg-blue-500' : 'border-border'
                      }`}
                    >
                      {isChecked && (
                        <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-secondary-foreground">{deviation}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Information Sources */}
        <div>
          <label className="text-secondary-foreground mb-2 block text-sm font-medium">
            {(PRELIMINARY_SECTION as any).sources.label}
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {INFORMATION_SOURCES.map(source => {
              const isChecked = preliminaryState?.sources?.[source] || false;
              return (
                <button
                  key={source}
                  type="button"
                  onClick={() => !disabled && handleSourceToggle(source)}
                  disabled={disabled}
                  className={`flex items-center rounded border p-2 text-left text-xs transition-colors ${
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${isChecked ? 'border-blue-300 bg-blue-50' : 'border-border bg-card hover:border-border'}`}
                >
                  <div
                    className={`mr-2 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                      isChecked ? 'border-blue-500 bg-blue-500' : 'border-border'
                    }`}
                  >
                    {isChecked && (
                      <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-muted-foreground">{source}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
