import { useId } from 'react';
import { RESPONSE_LABELS } from '@corates/shared/checklists/rob2';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import { useReconciledText } from '../../fields';

/**
 * Get badge color for ROB-2 answer type
 */
function getAnswerBadgeStyle(answer: string): string {
  switch (answer) {
    case 'Y':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'PY':
      return 'bg-lime-100 text-lime-800 border-lime-200';
    case 'PN':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'N':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'NI':
      return 'bg-secondary text-muted-foreground border-border';
    case 'NA':
      return 'bg-slate-100 text-slate-600 border-slate-200';
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

/**
 * Edits the final comment as a live collaborative field (`useReconciledText`
 * — a Yjs field online, the answer row in local practice).
 */
function FinalCommentEditor({ fieldKey }: { fieldKey: string }) {
  const comment = useReconciledText(fieldKey);
  return (
    <NoteEditor
      value={comment.value}
      onChange={comment.setValue}
      live={true}
      disabled={!comment.canWrite}
      placeholder='Add the final reconciled comment...'
      inline={true}
      focusRingColor='blue-400'
    />
  );
}

interface ROB2AnswerPanelProps {
  title: string;
  panelType: 'reviewer1' | 'reviewer2' | 'final';
  answer: string | null;
  /** Reviewer panels only: the reviewer's comment from their answer row. */
  comment?: string | null;
  /** Final panel only: the comment's flat answer key on the reconciled checklist. */
  finalCommentKey?: string;
  responseOptions: string[];
  readOnly: boolean;
  isSelected?: boolean;
  /** The question was skipped: no stored answer because it sits off the scoring path. */
  skipped?: boolean;
  onAnswerChange?: (_answer: string) => void;
  onUseThis?: () => void;
}

/**
 * Panel showing one version of answers (reviewer or final) for ROB-2
 */
export function ROB2AnswerPanel({
  title,
  panelType,
  answer,
  comment,
  finalCommentKey,
  responseOptions,
  readOnly,
  isSelected,
  skipped = false,
  onAnswerChange,
  onUseThis,
}: ROB2AnswerPanelProps) {
  const isFinal = panelType === 'final';
  const radioGroupName = useId();

  return (
    <div className='p-4'>
      {/* Panel Header */}
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-foreground font-semibold'>{title}</h3>
        {!isFinal && (
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
      <div className='mb-4 flex flex-wrap gap-2'>
        {responseOptions.map(option => {
          const optionSelected = answer === option;
          const baseClasses =
            'inline-flex items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all';

          if (readOnly) {
            return (
              <div
                key={option}
                className={`${baseClasses} ${
                  optionSelected ? getSelectedAnswerStyle() : (
                    'border-border bg-card text-secondary-foreground'
                  )
                }`}
              >
                <span className='mr-1'>{option}</span>
                <span className='text-xs opacity-70'>
                  ({RESPONSE_LABELS[option as keyof typeof RESPONSE_LABELS]})
                </span>
              </div>
            );
          }

          return (
            <label
              key={option}
              className={`${baseClasses} cursor-pointer focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-1 focus-within:outline-none hover:border-blue-300 ${
                optionSelected ? getSelectedAnswerStyle() : (
                  'border-border bg-card text-secondary-foreground hover:bg-blue-50'
                )
              }`}
            >
              <input
                type='radio'
                name={radioGroupName}
                value={option}
                checked={optionSelected}
                onChange={() => onAnswerChange?.(option)}
                className='hidden'
              />
              <span className='mr-1'>{option}</span>
              <span className='text-xs opacity-70'>
                ({RESPONSE_LABELS[option as keyof typeof RESPONSE_LABELS]})
              </span>
            </label>
          );
        })}
      </div>

      {/* Skipped badge: a null answer here is deliberate, not missing work */}
      {skipped && !answer && (
        <div className='mb-4 flex flex-wrap items-center gap-2'>
          <span
            className='inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600'
            title='The judgement was already determined by the other answers, so this question was not required.'
          >
            Skipped - Not applicable
          </span>
        </div>
      )}

      {/* Result Badge (for reviewer panels) */}
      {!isFinal && answer && (
        <div className='mb-4 flex flex-wrap items-center gap-2'>
          <span className='text-muted-foreground text-xs'>Selected:</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getAnswerBadgeStyle(answer)}`}
          >
            {answer} - {RESPONSE_LABELS[answer as keyof typeof RESPONSE_LABELS]}
          </span>
        </div>
      )}

      {/* Comment Section */}
      <div className='mt-4'>
        <label className='text-secondary-foreground mb-1 block text-xs font-medium'>
          {isFinal ? 'Final Comment' : 'Comment'}
        </label>
        {readOnly || finalCommentKey == null ?
          <div className='border-border bg-muted rounded-lg border p-3'>
            <p className='text-secondary-foreground text-sm whitespace-pre-wrap'>
              {comment || <span className='text-muted-foreground/70 italic'>No comment</span>}
            </p>
          </div>
        : <FinalCommentEditor fieldKey={finalCommentKey} />}
      </div>
    </div>
  );
}
