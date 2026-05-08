import { useMemo, useId } from 'react';
import { AlertCircleIcon } from 'lucide-react';
import { SECTION_B, RESPONSE_LABELS } from './checklist-map';
import { NoteEditor } from '@/components/checklist/common/NoteEditor';
import {
  useAnswer,
  useAnswersYMap,
  useProjectReactor,
} from '@/primitives/useProject/reactor/hooks';
import { resolveYText } from '@/primitives/useProject/reactor/ytext';
import type * as Y from 'yjs';

interface SectionBProps {
  studyId: string;
  checklistId: string;
  disabled?: boolean;
}

export function SectionB({ studyId, checklistId, disabled }: SectionBProps) {
  const uniqueId = useId();
  const answersYMap = useAnswersYMap(studyId, checklistId);

  const b2Answer = useAnswer<string>(studyId, checklistId, 'sectionB.b2');
  const b3Answer = useAnswer<string>(studyId, checklistId, 'sectionB.b3');
  const stopAssessment = useMemo(() => {
    const isYesOrPY = (v: string | null) => v === 'Y' || v === 'PY';
    return isYesOrPY(b2Answer) || isYesOrPY(b3Answer);
  }, [b2Answer, b3Answer]);

  const handleAnswerChange = (questionKey: string, value: string) => {
    const currentVal = answersYMap?.get(`sectionB.${questionKey}`) as string | null;
    answersYMap?.set(`sectionB.${questionKey}`, currentVal === value ? null : value);
  };

  const responseOptions = ['Y', 'PY', 'PN', 'N'];

  const { ydoc } = useProjectReactor();

  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div className='border-border bg-muted border-b px-6 py-4'>
        <h3 className='text-foreground text-base font-semibold'>
          Section B: Decide Whether to Proceed With Risk-of-Bias Assessment
        </h3>
        <p className='text-muted-foreground mt-1 text-xs'>
          If B2 or B3 is Yes/Probably Yes, the result is classified as Critical risk of bias.
        </p>
      </div>

      <div className='px-6 py-4'>
        {Object.entries(SECTION_B as Record<string, any>).map(([key, question]) => (
          <SectionBQuestion
            key={key}
            ydoc={ydoc}
            studyId={studyId}
            checklistId={checklistId}
            questionKey={key}
            question={question}
            disabled={disabled}
            uniqueId={uniqueId}
            responseOptions={responseOptions}
            onAnswerChange={handleAnswerChange}
          />
        ))}

        {stopAssessment && (
          <div className='border-destructive/20 bg-destructive/10 mt-5 rounded-lg border-2 p-4'>
            <div className='flex items-center gap-2'>
              <AlertCircleIcon className='text-destructive size-5' />
              <span className='text-destructive font-semibold'>Assessment Stopped</span>
            </div>
            <p className='text-destructive mt-2 text-sm'>
              Based on the responses to B2 or B3, this result should be classified as
              <span className='font-semibold'> Critical risk of bias</span>. Further domain
              assessment is not required.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionBQuestion({
  ydoc,
  studyId,
  checklistId,
  questionKey,
  question,
  disabled,
  uniqueId,
  responseOptions,
  onAnswerChange,
}: {
  ydoc: Y.Doc;
  studyId: string;
  checklistId: string;
  questionKey: string;
  question: any;
  disabled?: boolean;
  uniqueId: string;
  responseOptions: string[];
  onAnswerChange: (key: string, value: string) => void;
}) {
  const answer = useAnswer<string>(studyId, checklistId, `sectionB.${questionKey}`);

  const commentYText = useMemo(
    () => resolveYText(ydoc, studyId, checklistId, `sectionB.${questionKey}.comment`),
    [ydoc, studyId, checklistId, questionKey],
  );

  return (
    <div className='border-border border-b py-4 last:border-b-0'>
      <div className='flex flex-col gap-2'>
        <div className='text-secondary-foreground text-sm'>
          <span className='font-medium'>{questionKey.toUpperCase()}.</span>
          <span className='ml-1'>{question.text}</span>
        </div>

        {question.info && (
          <p className='border-warning-border bg-warning-bg text-warning-foreground rounded-lg border px-3 py-2 text-xs'>
            {question.info}
          </p>
        )}

        <div className='flex flex-wrap gap-2'>
          {responseOptions.map(option => (
            <label
              key={option}
              className={`inline-flex cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${
                disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-blue-300'
              } focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-1 focus-within:outline-none ${
                answer === option ?
                  'border-blue-400 bg-blue-50 text-blue-800'
                : 'border-border bg-card text-secondary-foreground hover:bg-blue-50'
              }`}
            >
              <input
                type='radio'
                name={`sectionB-${uniqueId}-${questionKey}`}
                value={option}
                checked={answer === option}
                onChange={() => onAnswerChange(questionKey, option)}
                disabled={disabled}
                className='hidden'
              />
              <span className='mr-1'>{option}</span>
              <span className='text-xs opacity-70'>({RESPONSE_LABELS[option]})</span>
            </label>
          ))}
        </div>

        <div className='mt-2'>
          <NoteEditor
            yText={commentYText}
            placeholder='Comment (optional)'
            readOnly={disabled}
            inline={true}
          />
        </div>
      </div>
    </div>
  );
}
