import { useMemo } from 'react';
import { ChevronDownIcon, ChevronRightIcon, CheckIcon } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  getSectionLabel,
  hasNavItemAnswer,
  isNavItemAgreement,
  getNavItemPillStyle,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';

interface NavbarDomainPillProps {
  sectionKey: string;
  progress: any;
  isExpanded: boolean;
  isCurrentDomain: boolean;
  onClick: () => void;
  allNavItems: any[];
  currentPage: number;
  goToPage: (_index: number) => void;
  comparison: any;
  finalAnswers: any;
  skippableQuestions: Set<string>;
}

/**
 * Domain pill that expands inline to show question pills
 */
export function NavbarDomainPill({
  sectionKey,
  progress,
  isExpanded,
  isCurrentDomain,
  onClick,
  allNavItems,
  currentPage,
  goToPage,
  comparison,
  finalAnswers,
  skippableQuestions,
}: NavbarDomainPillProps) {
  const label = getSectionLabel(sectionKey);

  const containerStyle = useMemo(() => {
    let base = 'flex items-center rounded-md transition-all bg-secondary overflow-visible ';
    if (!isExpanded && isCurrentDomain) {
      base += 'ring-2 ring-blue-300 ';
    }
    return base;
  }, [isExpanded, isCurrentDomain]);

  const labelStyle = useMemo(() => {
    let base =
      'flex items-center gap-1 rounded-md px-2 py-2 text-xs font-medium cursor-pointer select-none transition-all text-secondary-foreground ';
    if (isExpanded) {
      base += 'bg-border hover:bg-border ';
    } else {
      base += 'hover:bg-border ';
    }
    return base;
  }, [isExpanded]);

  const tooltipContent = useMemo(() => {
    const section = progress?.section || sectionKey;
    const answered = progress?.answered || 0;
    const total = progress?.total || 0;

    if (answered === total && total > 0) {
      return `${section}: Complete (${total}/${total})`;
    }
    return `${section}: ${answered}/${total}`;
  }, [progress, sectionKey]);

  const items = progress?.items || [];

  return (
    <div className={containerStyle}>
      {/* Label/collapse button */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button type='button' onClick={onClick} className={labelStyle}>
            <span className='font-semibold'>{label}</span>
            {!isExpanded && (
              <span className='text-2xs opacity-80'>
                {progress?.answered || 0}/{progress?.total || 0}
              </span>
            )}
            {sectionKey !== 'overall' &&
              (isExpanded ?
                <ChevronDownIcon className='size-3 opacity-60' />
              : <ChevronRightIcon className='size-3 opacity-60' />)}
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>

      {/* Horizontal expand/collapse for question pills */}
      <div
        className='flex items-center overflow-hidden py-1 transition-[max-width,opacity] duration-200 ease-out'
        style={{
          maxWidth: isExpanded ? `${items.length * 36}px` : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        {items.map((item: any, idx: number) => {
          const globalIndex = allNavItems?.indexOf(item) ?? -1;
          const itemCount = items.length;
          const isFirst = idx === 0;
          const isLast = idx === itemCount - 1;

          return (
            <QuestionPill
              key={item.key}
              item={item}
              globalIndex={globalIndex}
              currentPage={currentPage}
              goToPage={goToPage}
              comparison={comparison}
              finalAnswers={finalAnswers}
              isFirst={isFirst}
              isLast={isLast}
              isSkipped={skippableQuestions?.has(item.key)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface QuestionPillProps {
  item: any;
  globalIndex: number;
  currentPage: number;
  goToPage: (_index: number) => void;
  comparison: any;
  finalAnswers: any;
  isFirst: boolean;
  isLast: boolean;
  isSkipped?: boolean;
}

/**
 * Get the display label for a nav item pill
 */
function getDisplayLabel(item: any): string {
  if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
    return item.key?.substring(0, 2) || '?';
  }
  if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
    const parts = item.label?.split('.') || [];
    return parts.length > 1 ? parts[1] : item.label;
  }
  if (
    item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION ||
    item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION
  ) {
    return 'D';
  }
  return item.label || '?';
}

/**
 * Individual question pill within expanded domain
 */
function QuestionPill({
  item,
  globalIndex,
  currentPage,
  goToPage,
  comparison,
  finalAnswers,
  isFirst,
  isLast,
  isSkipped,
}: QuestionPillProps) {
  const isCurrentPage = currentPage === globalIndex;
  const agreement = isNavItemAgreement(item, comparison);
  const hasAnswer = hasNavItemAnswer(item, finalAnswers);

  const pillStyle = useMemo(() => {
    if (isSkipped && !isCurrentPage) {
      return 'bg-slate-100 text-slate-400';
    }
    return getNavItemPillStyle(isCurrentPage, hasAnswer, agreement);
  }, [isSkipped, isCurrentPage, hasAnswer, agreement]);

  const tooltip = useMemo(() => {
    let status = '';
    if (isSkipped) {
      status = 'Skipped (auto-set to NA)';
    } else if (hasAnswer) {
      status = 'Reconciled';
    } else if (agreement) {
      status = 'Agreement (not yet confirmed)';
    } else {
      status = 'Needs reconciliation';
    }
    return `${item.label}: ${status}`;
  }, [isSkipped, hasAnswer, agreement, item.label]);

  const displayLabel = getDisplayLabel(item);

  const isDirection =
    item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION || item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION;

  const pillSizeClass = isDirection ? 'h-6 px-2 text-2xs' : 'size-6 text-2xs';

  const pillSpacingClass = useMemo(() => {
    let spacing = '';
    if (isFirst) spacing += 'ml-0.5 ';
    if (isLast) spacing += 'mr-0.5 ';
    if (!isFirst && !isLast) spacing += 'mx-0.5 ';
    if (isFirst && !isLast) spacing += 'mr-0.5 ';
    if (!isFirst && isLast) spacing += 'ml-0.5 ';
    return spacing;
  }, [isFirst, isLast]);

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type='button'
          onClick={() => goToPage?.(globalIndex)}
          className={`relative flex items-center justify-center overflow-visible rounded-full font-medium transition-all ${pillSizeClass} ${pillSpacingClass} ${pillStyle}`}
          aria-label={tooltip}
          aria-current={isCurrentPage ? 'page' : undefined}
        >
          {displayLabel}
          {hasAnswer && (
            <span
              className='bg-card absolute -top-0.5 -right-0.5 flex size-2.5 items-center justify-center rounded-full border-[0.5px] shadow-sm'
              aria-hidden='true'
            >
              <CheckIcon className='size-1.5 text-green-600' />
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
