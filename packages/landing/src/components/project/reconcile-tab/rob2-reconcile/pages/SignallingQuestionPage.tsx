import { useMemo } from 'react';
import { CheckIcon, XIcon, InfoIcon } from 'lucide-react';
import {
  ROB2_CHECKLIST,
  RESPONSE_TYPES,
  getDomainQuestions,
} from '@corates/shared/checklists/rob2';
import { ROB2AnswerPanel } from '../panels/ROB2AnswerPanel';

interface SignallingQuestionPageProps {
  domainKey: string;
  questionKey: string;
  reviewer1Data: any;
  reviewer2Data: any;
  finalData: any;
  finalCommentYText: any;
  reviewer1Name: string;
  reviewer2Name: string;
  isAgreement: boolean;
  isSkipped: boolean;
  onFinalAnswerChange: (_answer: string) => void;
  onUseReviewer1: () => void;
  onUseReviewer2: () => void;
}

/**
 * Page for reconciling a ROB-2 signalling question
 */
export function SignallingQuestionPage({
  domainKey,
  questionKey,
  reviewer1Data,
  reviewer2Data,
  finalData,
  finalCommentYText,
  reviewer1Name,
  reviewer2Name,
  isAgreement,
  isSkipped,
  onFinalAnswerChange,
  onUseReviewer1,
  onUseReviewer2,
}: SignallingQuestionPageProps) {
  const domain = (ROB2_CHECKLIST as Record<string, any>)[domainKey];
  const questions = useMemo(() => getDomainQuestions(domainKey), [domainKey]);
  const question = questions[questionKey];

  const responseOptions = useMemo(() => {
    const responseType = question?.responseType || 'STANDARD';
    return [...RESPONSE_TYPES[responseType as keyof typeof RESPONSE_TYPES]];
  }, [question]);

  return (
    <div className="bg-card rounded-xl shadow-lg">
      {/* Header */}
      <div
        className={`rounded-t-xl border-b p-4 ${
          isAgreement ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div className="flex items-start gap-3">
          {isAgreement ? (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500">
              <CheckIcon className="h-4 w-4 text-white" />
            </div>
          ) : (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500">
              <XIcon className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-foreground font-semibold">
              {question?.number && <span className="mr-2">{question.number}:</span>}
              {question?.text || questionKey}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">{domain?.name}</p>
          </div>
        </div>

        {/* Info text if available */}
        {question?.info && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <InfoIcon className="h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-xs text-blue-800">{question.info}</p>
          </div>
        )}
      </div>

      {/* Skipped banner */}
      {isSkipped && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <InfoIcon className="h-4 w-4 shrink-0 text-slate-500" />
            <p className="text-sm text-slate-600">
              This question was auto-set to NA because the domain judgement is already determined by
              earlier answers. You can still change it if needed.
            </p>
          </div>
        </div>
      )}

      {/* Three-column comparison */}
      <div className={`grid grid-cols-3 divide-x ${isSkipped ? 'opacity-60' : ''}`}>
        {/* Reviewer 1 */}
        <ROB2AnswerPanel
          title={reviewer1Name || 'Reviewer 1'}
          panelType="reviewer1"
          answer={reviewer1Data?.answer}
          comment={reviewer1Data?.comment}
          responseOptions={responseOptions}
          readOnly={true}
          onUseThis={onUseReviewer1}
        />

        {/* Reviewer 2 */}
        <ROB2AnswerPanel
          title={reviewer2Name || 'Reviewer 2'}
          panelType="reviewer2"
          answer={reviewer2Data?.answer}
          comment={reviewer2Data?.comment}
          responseOptions={responseOptions}
          readOnly={true}
          onUseThis={onUseReviewer2}
        />

        {/* Final Answer */}
        <ROB2AnswerPanel
          title="Final Answer"
          panelType="final"
          answer={finalData?.answer}
          commentYText={finalCommentYText}
          responseOptions={responseOptions}
          readOnly={false}
          onAnswerChange={onFinalAnswerChange}
          hideUseThis={true}
        />
      </div>
    </div>
  );
}
