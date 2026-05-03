import { useMemo } from 'react';
import { ROB2_CHECKLIST, getDomainQuestions } from './checklist-map';
import { SignallingQuestion } from './SignallingQuestion';
import { DomainJudgement, JudgementBadge } from './DomainJudgement';
import { getRequiredQuestions } from './checklist.js';
import {
  useAnswer,
  useAnswersYMap,
  useROB2DomainScore,
} from '@/primitives/useProject/reactor/hooks';
import type { DomainAnswers } from '@corates/shared/checklists/rob2';

interface DomainSectionProps {
  studyId: string;
  checklistId: string;
  domainKey: string;
  disabled?: boolean;
  showComments?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DomainSection({
  studyId,
  checklistId,
  domainKey,
  disabled,
  showComments,
  collapsed,
  onToggleCollapse,
}: DomainSectionProps) {
  const domain = (ROB2_CHECKLIST as any)[domainKey];
  const questions = useMemo(() => getDomainQuestions(domainKey), [domainKey]);
  const questionKeys = useMemo(() => Object.keys(questions), [questions]);

  const { judgement: autoJudgement, isComplete: autoComplete } = useROB2DomainScore(
    studyId,
    checklistId,
    domainKey,
  );
  const direction = useAnswer<string>(studyId, checklistId, `${domainKey}.direction`);
  const answersYMap = useAnswersYMap(studyId, checklistId);

  const answersForRequired = (() => {
    if (!answersYMap) return undefined;
    const a: DomainAnswers = {};
    for (const qKey of questionKeys) {
      a[qKey] = { answer: (answersYMap.get(qKey) as string) ?? null };
    }
    return a;
  })();

  const requiredQuestions = getRequiredQuestions(domainKey, answersForRequired);

  const hasAnyAnswer = answersYMap ? questionKeys.some(qKey => answersYMap.get(qKey) != null) : false;

  const isQuestionSkippable = (qKey: string) =>
    hasAnyAnswer &&
    requiredQuestions.size > 0 &&
    !requiredQuestions.has(qKey) &&
    answersYMap?.get(qKey) == null;

  const completionStatus = {
    answered: answersYMap ? questionKeys.filter(k => answersYMap.get(k) != null).length : 0,
    total: questionKeys.length,
  };

  const handleDirectionChange = (dir: string | null) => {
    answersYMap?.set(`${domainKey}.direction`, dir);
  };

  return (
    <div className='bg-card overflow-hidden rounded-lg shadow-md'>
      <button
        type='button'
        onClick={() => onToggleCollapse?.()}
        className='bg-muted hover:bg-secondary flex w-full items-center justify-between px-6 py-4 transition-colors'
      >
        <div className='flex flex-col items-start'>
          <h3 className='text-foreground text-left font-semibold'>{domain?.name}</h3>
          {domain?.subtitle && (
            <span className='text-muted-foreground mt-0.5 text-xs'>{domain.subtitle}</span>
          )}
        </div>

        <div className='flex items-center gap-3'>
          <span className='text-muted-foreground/70 text-xs'>
            {completionStatus.answered}/{completionStatus.total}
          </span>

          {autoJudgement ?
            <JudgementBadge judgement={autoJudgement} />
          : !autoComplete && <span className='text-muted-foreground/70 text-xs'>Incomplete</span>}

          <svg
            className={`text-muted-foreground/70 size-5 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M19 9l-7 7-7-7' />
          </svg>
        </div>
      </button>

      {!collapsed && (
        <div className='px-6 py-4'>
          <div className='flex flex-col gap-1'>
            {Object.entries(questions).map(([qKey, qDef]: [string, any]) => (
              <SignallingQuestion
                key={qKey}
                studyId={studyId}
                checklistId={checklistId}
                questionKey={qKey}
                question={qDef}
                disabled={disabled}
                showComment={showComments}
                isSkippable={isQuestionSkippable(qKey)}
              />
            ))}
          </div>

          <div className='bg-muted mt-4 rounded-lg p-4'>
            <div className='mb-3 flex items-center gap-3'>
              <span className='text-secondary-foreground text-sm font-medium'>
                Risk of bias judgement
              </span>
              {autoJudgement ?
                <div className='bg-card flex items-center gap-2 rounded-md px-2.5 py-1 text-xs shadow-sm'>
                  <span className='text-muted-foreground'>Calculated:</span>
                  <JudgementBadge judgement={autoJudgement} />
                </div>
              : !autoComplete && (
                  <span className='text-muted-foreground/70 text-xs'>(answer more questions)</span>
                )
              }
            </div>

            {domain?.hasDirection && (
              <DomainJudgement
                domainId={domainKey}
                judgement={autoJudgement}
                direction={direction}
                onJudgementChange={() => {}}
                onDirectionChange={handleDirectionChange}
                showDirection={true}
                disabled={disabled}
                isAutoMode={true}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
