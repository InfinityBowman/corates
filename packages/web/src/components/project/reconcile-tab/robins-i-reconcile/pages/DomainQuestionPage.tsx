import {
  getDomainQuestions,
  RESPONSE_TYPES,
  ROBINS_I_CHECKLIST,
} from '@/components/checklist/ROBINSIChecklist/checklist-map';
import { RobinsAnswerPanel } from '../panels/RobinsAnswerPanel';

interface DomainQuestionPageProps {
  domainKey: string;
  questionKey: string;
  reviewer1Data?: { answer?: string; comment?: string } | null;
  reviewer2Data?: { answer?: string; comment?: string } | null;
  finalData?: { answer?: string } | null;
  finalCommentYText?: any;
  reviewer1Name: string;
  reviewer2Name: string;
  isAgreement: boolean;
  onFinalAnswerChange: (_answer: string) => void;
  onUseReviewer1: () => void;
  onUseReviewer2: () => void;
  selectedSource?: 'reviewer1' | 'reviewer2' | null;
}

export function DomainQuestionPage({
  domainKey,
  questionKey,
  reviewer1Data,
  reviewer2Data,
  finalData,
  finalCommentYText,
  reviewer1Name,
  reviewer2Name,
  isAgreement,
  onFinalAnswerChange,
  onUseReviewer1,
  onUseReviewer2,
  selectedSource,
}: DomainQuestionPageProps) {
  const domain = (ROBINS_I_CHECKLIST as Record<string, any>)[domainKey];
  const questions = getDomainQuestions(domainKey);
  const question = (questions as Record<string, any>)[questionKey];
  const responseOptions =
    (RESPONSE_TYPES as unknown as Record<string, readonly string[]>)[question?.responseType] ||
    (RESPONSE_TYPES as unknown as Record<string, readonly string[]>).WITH_NI;

  return (
    <div className='bg-card overflow-hidden rounded-lg shadow-lg'>
      {/* Domain Header */}
      <div className='border-border bg-muted border-b px-4 py-2'>
        <h3 className='text-secondary-foreground text-sm font-medium'>{domain?.name}</h3>
        {domain?.subtitle && <p className='text-muted-foreground text-xs'>{domain.subtitle}</p>}
      </div>

      {/* Question Header */}
      <div
        className={`p-4 ${
          isAgreement ?
            'border-b border-green-200 bg-green-50'
          : 'border-b border-amber-200 bg-amber-50'
        }`}
      >
        <h2 className='text-md text-foreground font-medium'>
          <span className='font-semibold'>{question?.number}.</span> {question?.text}
        </h2>
        {question?.note && <p className='text-muted-foreground mt-2 text-sm'>{question.note}</p>}
        <div className='mt-2 flex items-center gap-3'>
          <span
            className={`text-xs font-medium ${isAgreement ? 'text-green-700' : 'text-amber-700'}`}
          >
            {isAgreement ? 'Reviewers Agree' : 'Requires Reconciliation'}
          </span>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className='divide-border grid grid-cols-3 divide-x'>
        <RobinsAnswerPanel
          title={reviewer1Name || 'Reviewer 1'}
          panelType='reviewer1'
          answer={reviewer1Data?.answer}
          comment={reviewer1Data?.comment}
          responseOptions={responseOptions}
          readOnly={true}
          hideUseThis={isAgreement}
          isSelected={selectedSource === 'reviewer1'}
          onUseThis={onUseReviewer1}
        />

        <RobinsAnswerPanel
          title={reviewer2Name || 'Reviewer 2'}
          panelType='reviewer2'
          answer={reviewer2Data?.answer}
          comment={reviewer2Data?.comment}
          responseOptions={responseOptions}
          readOnly={true}
          hideUseThis={isAgreement}
          isSelected={selectedSource === 'reviewer2'}
          onUseThis={onUseReviewer2}
        />

        <RobinsAnswerPanel
          title='Final Answer'
          panelType='final'
          answer={finalData?.answer}
          commentYText={finalCommentYText}
          responseOptions={responseOptions}
          readOnly={false}
          hideUseThis={true}
          onAnswerChange={onFinalAnswerChange}
        />
      </div>
    </div>
  );
}
