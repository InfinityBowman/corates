/**
 * Navbar - Navigation bar for AMSTAR2 checklist reconciliation
 * Displays question pills with visual indicators for agreement/disagreement status
 */

import { useMemo } from 'react';
import { RotateCcwIcon, CheckIcon } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { hasQuestionAnswer, getQuestionPillStyle, getQuestionTooltip } from './navbar-utils.js';
import { QuestionPresenceIndicator } from '../QuestionPresenceIndicator';
import type { RemoteUser } from '@/hooks/useReconciliationPresence';

interface NavbarStore {
  questionKeys: string[];
  viewMode: string;
  currentPage: number;
  comparisonByQuestion: Record<string, any>;
  finalAnswers: Record<string, any>;
  setViewMode: ((_mode: string) => void) | null;
  goToQuestion: ((_index: number) => void) | null;
  onReset: (() => void) | null;
}

interface NavbarProps {
  store: NavbarStore;
  usersByPage?: Map<number, RemoteUser[]>;
}

export function Navbar({ store, usersByPage }: NavbarProps) {
  return (
    <nav className='flex flex-wrap gap-1 py-1 pl-1' aria-label='Question navigation'>
      {store.questionKeys.map((key, index) => (
        <QuestionPill
          key={key}
          questionIndex={index}
          store={store}
          usersOnPage={usersByPage?.get(index) || []}
        />
      ))}
      <SummaryButton store={store} />
      <ResetButton onClick={() => store.onReset?.()} />
    </nav>
  );
}

function QuestionPill({
  questionIndex,
  store,
  usersOnPage,
}: {
  questionIndex: number;
  store: NavbarStore;
  usersOnPage: RemoteUser[];
}) {
  const key = store.questionKeys[questionIndex];
  const isCurrentPage = store.viewMode === 'questions' && store.currentPage === questionIndex;
  const isAgreement = store.comparisonByQuestion[key]?.isAgreement ?? true;
  const hasAnswer = hasQuestionAnswer(key, store.finalAnswers);

  const pillStyle = useMemo(
    () => getQuestionPillStyle(isCurrentPage, hasAnswer, isAgreement),
    [isCurrentPage, hasAnswer, isAgreement],
  );

  const tooltip = useMemo(() => {
    const baseTooltip = getQuestionTooltip(questionIndex + 1, hasAnswer, isAgreement);
    if (usersOnPage.length === 0) return baseTooltip;
    const viewerNames = usersOnPage.map(u => u.name).join(', ');
    return `${baseTooltip} | Viewing: ${viewerNames}`;
  }, [questionIndex, hasAnswer, isAgreement, usersOnPage]);

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          onClick={() => store.goToQuestion?.(questionIndex)}
          className={`relative h-8 w-8 rounded-full text-xs font-medium transition-all ${pillStyle}`}
          aria-label={tooltip}
          aria-current={isCurrentPage ? 'page' : undefined}
        >
          {/* Presence indicator */}
          {!isCurrentPage && <QuestionPresenceIndicator users={usersOnPage} size='sm' />}

          {questionIndex + 1}

          {hasAnswer && (
            <span
              className='absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-[0.5px] bg-white shadow-sm'
              aria-hidden='true'
            >
              <CheckIcon className='h-2.5 w-2.5 text-green-600' />
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side='bottom'>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function SummaryButton({ store }: { store: NavbarStore }) {
  const isActive = store.viewMode === 'summary';
  const buttonStyle =
    isActive ?
      'bg-blue-600 text-white ring-2 ring-blue-300'
    : 'bg-secondary text-muted-foreground hover:bg-border';

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          onClick={() => store.setViewMode?.('summary')}
          className={`h-8 rounded-full px-3 text-xs font-medium transition-all ${buttonStyle}`}
          aria-label='View summary'
          aria-current={isActive ? 'page' : undefined}
        >
          Summary
        </button>
      </TooltipTrigger>
      <TooltipContent side='bottom'>View summary of all questions</TooltipContent>
    </Tooltip>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className='flex h-8 items-center gap-1 rounded-full bg-red-100 px-3 text-xs font-medium text-red-700 transition-all hover:bg-red-200'
          aria-label='Reset reconciliation'
        >
          <RotateCcwIcon className='h-3 w-3' />
          Reset
        </button>
      </TooltipTrigger>
      <TooltipContent side='bottom'>Reset final answers to unresolved</TooltipContent>
    </Tooltip>
  );
}
