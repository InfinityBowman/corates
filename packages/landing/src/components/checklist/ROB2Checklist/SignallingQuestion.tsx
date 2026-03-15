/**
 * SignallingQuestion - A single signalling question with response button options
 * Used by ROB2 DomainSection for each question within a domain.
 */

import { useEffect, useMemo, useCallback } from 'react';
import { RESPONSE_LABELS, getResponseOptions } from './checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';

interface SignallingQuestionProps {
  question: any;
  answer: any;
  onUpdate: (_newAnswer: any) => void;
  disabled?: boolean;
  showComment?: boolean;
  domainKey?: string;
  questionKey?: string;
  getRob2Text?: (_sectionKey: string, _fieldKey: string, _questionKey?: string) => any;
  isSkippable?: boolean;
}

export function SignallingQuestion({
  question,
  answer,
  onUpdate,
  disabled,
  showComment,
  domainKey,
  questionKey,
  getRob2Text,
  isSkippable,
}: SignallingQuestionProps) {
  const options = useMemo(() => getResponseOptions(question.responseType), [question.responseType]);

  // Coerce NA to NI if NA is not valid for this question type.
  // Only answer?.answer is in deps to avoid re-triggering on comment changes.
  useEffect(() => {
    if (answer?.answer === 'NA' && !options.includes('NA')) {
      onUpdate({ ...answer, answer: 'NI' });
    }
  }, [answer?.answer, options]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswerChange = useCallback(
    (value: string) => {
      const newValue = answer?.answer === value ? null : value;
      onUpdate({ ...answer, answer: newValue });
    },
    [answer, onUpdate],
  );

  const commentYText = useMemo(() => {
    if (!showComment || !getRob2Text || !domainKey || !questionKey) return null;
    return getRob2Text(domainKey, 'comment', questionKey);
  }, [showComment, getRob2Text, domainKey, questionKey]);

  return (
    <div className={`border-border/50 border-b py-3 last:border-b-0 ${isSkippable ? 'opacity-50' : ''}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          {question.number && (
            <span className="text-secondary-foreground text-sm font-medium">
              {question.number}
            </span>
          )}
          <span className="text-muted-foreground ml-2 text-sm">{question.text}</span>
          {isSkippable && <span className="ml-2 text-xs text-green-600">(Optional)</span>}
        </div>

        <div className="flex shrink-0 flex-wrap gap-1 sm:gap-2">
          {options.map((option: string) => (
            <button
              key={option}
              type="button"
              onClick={() => !disabled && handleAnswerChange(option)}
              disabled={disabled}
              className={`relative inline-flex cursor-pointer items-center justify-center rounded border px-2 py-1 text-xs font-medium transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${
                answer?.answer === option
                  ? 'border-blue-400 bg-blue-100 text-blue-800'
                  : 'border-border bg-muted text-muted-foreground hover:bg-secondary'
              }`}
              title={RESPONSE_LABELS[option]}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {showComment && (
        <div className="mt-2">
          <NoteEditor
            yText={commentYText}
            placeholder="Comment (optional)"
            readOnly={disabled}
            inline={true}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Response legend showing what each abbreviation means
 */
export function ResponseLegend() {
  const commonResponses = ['Y', 'PY', 'PN', 'N', 'NI'];

  return (
    <div className="bg-muted mb-4 rounded-lg p-3">
      <div className="text-secondary-foreground mb-2 text-xs font-medium">Response Legend</div>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {commonResponses.map(code => (
          <span key={code}>
            <span className="font-medium">{code}</span> = {RESPONSE_LABELS[code]}
          </span>
        ))}
      </div>
    </div>
  );
}
