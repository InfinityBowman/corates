/**
 * DomainSection - ROBINS-I domain section with questions and auto-first judgement
 * Supports Auto/Manual mode toggle (unlike ROB2 which is auto-only).
 * Handles subsections for Domain 3.
 */

import { useMemo, useCallback } from 'react';
import { ROBINS_I_CHECKLIST, getDomainQuestions } from './checklist-map';
import { SignallingQuestion } from './SignallingQuestion';
import { DomainJudgement, JudgementBadge } from './DomainJudgement';
import { scoreRobinsDomain, getEffectiveDomainJudgement } from './scoring/robins-scoring.js';

interface DomainSectionProps {
  domainKey: string;
  domainState: any;
  onUpdate: (_newState: any) => void;
  disabled?: boolean;
  showComments?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  getRobinsText?: (_sectionKey: string, _fieldKey: string, _questionKey?: string) => any;
}

export function DomainSection({
  domainKey,
  domainState,
  onUpdate,
  disabled,
  showComments,
  collapsed,
  onToggleCollapse,
  getRobinsText,
}: DomainSectionProps) {
  const domain = (ROBINS_I_CHECKLIST as any)[domainKey];
  const questions = useMemo(() => getDomainQuestions(domainKey), [domainKey]);
  const hasSubsections = !!domain?.subsections;

  const autoScore = useMemo(
    () => scoreRobinsDomain(domainKey, domainState?.answers),
    [domainKey, domainState?.answers],
  );

  const isEarlyComplete = autoScore.isComplete && autoScore.judgement !== null;

  const isQuestionSkippable = useCallback(
    (qKey: string) => isEarlyComplete && !domainState?.answers?.[qKey]?.answer,
    [isEarlyComplete, domainState?.answers],
  );

  const effectiveJudgement = useMemo(
    () => getEffectiveDomainJudgement(domainState, autoScore),
    [domainState, autoScore],
  );

  const isManualMode = domainState?.judgementSource === 'manual';

  const handleQuestionUpdate = useCallback(
    (questionKey: string, newAnswer: any) => {
      const newAnswers = { ...domainState?.answers, [questionKey]: newAnswer };
      const newAutoScore = scoreRobinsDomain(domainKey, newAnswers);
      const currentSource = domainState?.judgementSource || 'auto';
      const newState = { ...domainState, answers: newAnswers };

      if (currentSource === 'auto' && newAutoScore.judgement) {
        newState.judgement = newAutoScore.judgement;
      }

      onUpdate(newState);
    },
    [domainKey, domainState, onUpdate],
  );

  const handleJudgementChange = useCallback(
    (judgement: string | null) => {
      onUpdate({ ...domainState, judgement, judgementSource: 'manual' });
    },
    [domainState, onUpdate],
  );

  const handleDirectionChange = useCallback(
    (direction: string | null) => {
      onUpdate({ ...domainState, direction });
    },
    [domainState, onUpdate],
  );

  const handleRevertToAuto = useCallback(() => {
    onUpdate({ ...(domainState || {}), judgement: autoScore.judgement, judgementSource: 'auto' });
  }, [domainState, autoScore, onUpdate]);

  const handleSwitchToManual = useCallback(() => {
    const currentState = domainState || {};
    onUpdate({
      ...currentState,
      judgement: currentState.judgement || autoScore.judgement,
      judgementSource: 'manual',
    });
  }, [domainState, autoScore, onUpdate]);

  const completionStatus = useMemo(() => {
    const keys = Object.keys(questions);
    const answered = keys.filter(k => domainState?.answers?.[k]?.answer != null).length;
    return { answered, total: keys.length };
  }, [questions, domainState?.answers]);

  const renderQuestions = (qs: Record<string, any>) =>
    Object.entries(qs).map(([qKey, qDef]: [string, any]) => (
      <SignallingQuestion
        key={qKey}
        question={qDef}
        answer={domainState?.answers?.[qKey]}
        onUpdate={newAnswer => handleQuestionUpdate(qKey, newAnswer)}
        disabled={disabled}
        showComment={showComments}
        domainKey={domainKey}
        questionKey={qKey}
        getRobinsText={getRobinsText}
        isSkippable={isQuestionSkippable(qKey)}
      />
    ));

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
            <div className='flex items-center gap-1.5'>
              {isManualMode && <span className='text-warning text-xs'>Manual</span>}
              <JudgementBadge judgement={effectiveJudgement} />
            </div>
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
          {/* Questions - with or without subsections */}
          {hasSubsections ?
            <>
              {Object.entries(domain.subsections).map(([subKey, subsection]: [string, any]) => (
                <div key={subKey} className='mb-4'>
                  <div className='border-border/50 text-muted-foreground mb-2 border-b pb-1 text-sm font-medium'>
                    {subsection.name}
                  </div>
                  <div className='flex flex-col gap-1'>{renderQuestions(subsection.questions)}</div>
                </div>
              ))}
            </>
          : <div className='flex flex-col gap-1'>{renderQuestions(questions)}</div>}

          {/* Auto-first judgement section */}
          <div className='bg-muted mt-4 rounded-lg p-4'>
            <div className='mb-3 flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <span className='text-secondary-foreground text-sm font-medium'>
                  Risk of bias judgement
                </span>
                {autoScore.judgement ?
                  <div className='bg-card flex items-center gap-2 rounded-md px-2.5 py-1 text-xs shadow-sm'>
                    <span className='text-muted-foreground'>Calculated:</span>
                    <JudgementBadge judgement={autoScore.judgement} />
                  </div>
                : !autoScore.isComplete && (
                    <span className='text-muted-foreground/70 text-xs'>
                      (answer more questions)
                    </span>
                  )
                }
              </div>

              {/* Mode toggle */}
              <div className='flex items-center gap-2'>
                <div className='border-border bg-card flex rounded-md border text-xs'>
                  <button
                    type='button'
                    onClick={e => {
                      e.stopPropagation();
                      handleRevertToAuto();
                    }}
                    disabled={disabled}
                    className={`rounded-l-md px-2.5 py-1 transition-colors ${
                      !isManualMode ?
                        'bg-blue-100 text-blue-800'
                      : 'text-muted-foreground hover:bg-muted'
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    Auto
                  </button>
                  <button
                    type='button'
                    onClick={e => {
                      e.stopPropagation();
                      handleSwitchToManual();
                    }}
                    disabled={disabled}
                    className={`border-border rounded-r-md border-l px-2.5 py-1 transition-colors ${
                      isManualMode ?
                        'bg-warning-bg text-warning-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    Manual
                  </button>
                </div>
              </div>
            </div>

            <DomainJudgement
              domainId={domainKey}
              judgement={effectiveJudgement}
              direction={domainState?.direction}
              onJudgementChange={handleJudgementChange}
              onDirectionChange={handleDirectionChange}
              showDirection={domain?.hasDirection}
              isDomain1={domainKey === 'domain1a' || domainKey === 'domain1b'}
              disabled={disabled}
              isAutoMode={!isManualMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}
