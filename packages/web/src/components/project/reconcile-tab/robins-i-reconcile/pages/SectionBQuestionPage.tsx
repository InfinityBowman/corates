import { SECTION_B, RESPONSE_TYPES } from '@/components/checklist/ROBINSIChecklist/checklist-map';
import { RobinsAnswerPanel } from '../panels/RobinsAnswerPanel';

interface SectionBQuestionPageProps {
  questionKey: string;
  reviewer1Data?: { answer?: string | null; comment?: string } | null;
  reviewer2Data?: { answer?: string | null; comment?: string } | null;
  finalData?: { answer?: string | null } | null;
  finalCommentYText?: any;
  reviewer1Name: string;
  reviewer2Name: string;
  isAgreement: boolean;
  onFinalAnswerChange: (_answer: string) => void;
  onUseReviewer1: () => void;
  onUseReviewer2: () => void;
  selectedSource?: 'reviewer1' | 'reviewer2' | null;
}

export function SectionBQuestionPage({
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
}: SectionBQuestionPageProps) {
  const question = (SECTION_B as Record<string, any>)[questionKey];
  const responseOptions =
    (RESPONSE_TYPES as unknown as Record<string, readonly string[]>)[question?.responseType] ||
    (RESPONSE_TYPES as unknown as Record<string, readonly string[]>).STANDARD;

  return (
    <div className='bg-card overflow-hidden rounded-lg shadow-lg'>
      {/* Question Header */}
      <div
        className={`p-4 ${
          isAgreement ?
            'border-b border-green-200 bg-green-50'
          : 'border-b border-amber-200 bg-amber-50'
        }`}
      >
        <h2 className='text-md text-foreground font-medium'>
          <span className='font-semibold'>{questionKey.toUpperCase()}.</span> {question?.text}
        </h2>
        {question?.info && <p className='text-muted-foreground mt-2 text-sm'>{question.info}</p>}
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
          title={reviewer1Name}
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
          title={reviewer2Name}
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
