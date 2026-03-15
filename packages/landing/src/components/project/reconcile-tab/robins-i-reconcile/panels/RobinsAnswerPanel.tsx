import { useId } from 'react';
import { RESPONSE_LABELS } from '@/components/checklist/ROBINSIChecklist/checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';

/**
 * Get badge color for Robins-I answer type
 */
function getAnswerBadgeStyle(answer: string): string {
  switch (answer) {
    case 'Y':
    case 'SY':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'PY':
    case 'WY':
      return 'bg-lime-100 text-lime-800 border-lime-200';
    case 'PN':
    case 'WN':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'N':
    case 'SN':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'NI':
      return 'bg-secondary text-muted-foreground border-border';
    default:
      return 'bg-secondary text-muted-foreground border-border';
  }
}

/**
 * Get highlighted background color for selected answer
 */
function getSelectedAnswerStyle(): string {
  return 'border-blue-400 bg-blue-50 text-blue-800';
}

interface RobinsAnswerPanelProps {
  title: string;
  panelType: 'reviewer1' | 'reviewer2' | 'final';
  answer?: string | null;
  comment?: string | null;
  commentYText?: any;
  responseOptions: readonly string[];
  readOnly?: boolean;
  hideUseThis?: boolean;
  isSelected?: boolean;
  onAnswerChange?: (_answer: string) => void;
  onUseThis?: () => void;
}

export function RobinsAnswerPanel({
  title,
  panelType,
  answer,
  comment,
  commentYText,
  responseOptions,
  readOnly = false,
  hideUseThis = false,
  isSelected = false,
  onAnswerChange,
  onUseThis,
}: RobinsAnswerPanelProps) {
  const isFinal = panelType === 'final';
  const radioGroupName = useId();

  return (
    <div className="p-4">
      {/* Panel Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-foreground font-semibold">{title}</h3>
        {!isFinal && !hideUseThis && (
          <button
            onClick={() => onUseThis?.()}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              isSelected ? 'bg-blue-600 text-white' : (
                'bg-secondary text-secondary-foreground hover:bg-blue-100 hover:text-blue-700'
              )
            }`}
          >
            {isSelected ? 'Selected' : 'Use This'}
          </button>
        )}
      </div>

      {/* Response Options */}
      <div className="mb-4 flex flex-wrap gap-2">
        {responseOptions.map(option => {
          const optionSelected = answer === option;
          const baseClasses =
            'inline-flex items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all';

          return readOnly ? (
            <div
              key={option}
              className={`${baseClasses} ${
                optionSelected ? getSelectedAnswerStyle() : (
                  'border-border bg-card text-secondary-foreground'
                )
              }`}
            >
              <span className="mr-1">{option}</span>
              <span className="text-xs opacity-70">
                ({(RESPONSE_LABELS as Record<string, string>)[option]})
              </span>
            </div>
          ) : (
            <label
              key={option}
              className={`${baseClasses} cursor-pointer focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-1 focus-within:outline-none hover:border-blue-300 ${
                optionSelected ? getSelectedAnswerStyle() : (
                  'border-border bg-card text-secondary-foreground hover:bg-blue-50'
                )
              }`}
            >
              <input
                type="radio"
                name={radioGroupName}
                value={option}
                checked={optionSelected}
                onChange={() => onAnswerChange?.(option)}
                className="hidden"
              />
              <span className="mr-1">{option}</span>
              <span className="text-xs opacity-70">
                ({(RESPONSE_LABELS as Record<string, string>)[option]})
              </span>
            </label>
          );
        })}
      </div>

      {/* Result Badge (for reviewer panels) */}
      {!isFinal && answer && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Selected:</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getAnswerBadgeStyle(answer)}`}
          >
            {answer} - {(RESPONSE_LABELS as Record<string, string>)[answer]}
          </span>
        </div>
      )}

      {/* Comment Section */}
      <div className="mt-4">
        <label className="text-secondary-foreground mb-1 block text-xs font-medium">
          {isFinal ? 'Final Comment' : 'Comment'}
        </label>
        {!readOnly ? (
          <NoteEditor
            yText={commentYText}
            placeholder="Add the final reconciled comment..."
            readOnly={false}
            inline={true}
            focusRingColor="blue-400"
          />
        ) : (
          <div className="border-border bg-muted rounded-lg border p-3">
            <p className="text-secondary-foreground text-sm whitespace-pre-wrap">
              {comment || <span className="text-muted-foreground/70 italic">No comment</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
