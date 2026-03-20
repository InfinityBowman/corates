/**
 * DomainSection - A complete ROB2 domain section with questions and auto-scored judgement
 */

import { useMemo, useCallback } from 'react';
import { ROB2_CHECKLIST, getDomainQuestions } from './checklist-map';
import { SignallingQuestion } from './SignallingQuestion';
import { DomainJudgement, JudgementBadge } from './DomainJudgement';
import { scoreRob2Domain, getRequiredQuestions } from './checklist.js';

interface DomainSectionProps {
  domainKey: string;
  domainState: any;
  onUpdate: (_newState: any) => void;
  disabled?: boolean;
  showComments?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  getRob2Text?: (_sectionKey: string, _fieldKey: string, _questionKey?: string) => any;
}

export function DomainSection({
  domainKey,
  domainState,
  onUpdate,
  disabled,
  showComments,
  collapsed,
  onToggleCollapse,
  getRob2Text,
}: DomainSectionProps) {
  const domain = (ROB2_CHECKLIST as any)[domainKey];
  const questions = useMemo(() => getDomainQuestions(domainKey), [domainKey]);

  const autoScore = useMemo(
    () => scoreRob2Domain(domainKey, domainState?.answers),
    [domainKey, domainState?.answers],
  );

  const requiredQuestions = useMemo(
    () => getRequiredQuestions(domainKey, domainState?.answers),
    [domainKey, domainState?.answers],
  );

  // A question is skippable if it's not on the active scoring path
  // and hasn't already been answered
  const isQuestionSkippable = useCallback(
    (qKey: string) =>
      requiredQuestions.size > 0 &&
      !requiredQuestions.has(qKey) &&
      !domainState?.answers?.[qKey]?.answer,
    [requiredQuestions, domainState?.answers],
  );

  const effectiveJudgement = autoScore.judgement;

  const handleQuestionUpdate = useCallback(
    (questionKey: string, newAnswer: any) => {
      const newAnswers = { ...domainState?.answers, [questionKey]: newAnswer };
      const newAutoScore = scoreRob2Domain(domainKey, newAnswers);
      onUpdate({ ...domainState, answers: newAnswers, judgement: newAutoScore.judgement });
    },
    [domainKey, domainState, onUpdate],
  );

  const handleDirectionChange = useCallback(
    (direction: string | null) => {
      onUpdate({ ...domainState, direction });
    },
    [domainState, onUpdate],
  );

  const completionStatus = useMemo(() => {
    const qs = questions;
    const keys = Object.keys(qs);
    const answered = keys.filter(k => domainState?.answers?.[k]?.answer != null).length;
    return { answered, total: keys.length };
  }, [questions, domainState?.answers]);

  return (
    <div className='bg-card overflow-hidden rounded-lg shadow-md'>
      {/* Domain header */}
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

          {effectiveJudgement ?
            <JudgementBadge judgement={effectiveJudgement} />
          : !autoScore.isComplete && (
              <span className='text-muted-foreground/70 text-xs'>Incomplete</span>
            )
          }

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

      {/* Domain content */}
      {!collapsed && (
        <div className='px-6 py-4'>
          <div className='space-y-1'>
            {Object.entries(questions).map(([qKey, qDef]: [string, any]) => (
              <SignallingQuestion
                key={qKey}
                question={qDef}
                answer={domainState?.answers?.[qKey]}
                onUpdate={newAnswer => handleQuestionUpdate(qKey, newAnswer)}
                disabled={disabled}
                showComment={showComments}
                domainKey={domainKey}
                questionKey={qKey}
                getRob2Text={getRob2Text}
                isSkippable={isQuestionSkippable(qKey)}
              />
            ))}
          </div>

          {/* Auto judgement section */}
          <div className='bg-muted mt-4 rounded-lg p-4'>
            <div className='mb-3 flex items-center gap-3'>
              <span className='text-secondary-foreground text-sm font-medium'>
                Risk of bias judgement
              </span>
              {autoScore.judgement ?
                <div className='bg-card flex items-center gap-2 rounded-md px-2.5 py-1 text-xs shadow-sm'>
                  <span className='text-muted-foreground'>Calculated:</span>
                  <JudgementBadge judgement={autoScore.judgement} />
                </div>
              : !autoScore.isComplete && (
                  <span className='text-muted-foreground/70 text-xs'>(answer more questions)</span>
                )
              }
            </div>

            {domain?.hasDirection && (
              <DomainJudgement
                domainId={domainKey}
                judgement={effectiveJudgement}
                direction={domainState?.direction}
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
