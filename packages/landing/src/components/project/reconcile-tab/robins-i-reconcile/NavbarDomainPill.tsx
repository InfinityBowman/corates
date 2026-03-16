import { useMemo } from 'react';
import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  getSectionLabel,
  hasNavItemAnswer,
  isNavItemAgreement,
  getNavItemPillStyle,
  getNavItemTooltip,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';

interface NavItem {
  type: string;
  key: string;
  label: string;
  section: string;
  domainKey?: string;
  isJudgement?: boolean;
  [key: string]: any;
}

interface ProgressInfo {
  answered: number;
  total: number;
  hasDisagreements: boolean;
  isComplete: boolean;
  section: string;
  items: NavItem[];
}

interface NavbarDomainPillProps {
  sectionKey: string;
  progress: ProgressInfo;
  isExpanded: boolean;
  isCurrentDomain: boolean;
  onClick: () => void;
  allNavItems: NavItem[];
  currentPage: number;
  goToPage: (_index: number) => void;
  comparison: any;
  finalAnswers: any;
}

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
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button type='button' onClick={onClick} className={labelStyle}>
              <span className='font-semibold'>{label}</span>
              {!isExpanded && (
                <span className='text-2xs opacity-80'>
                  {progress?.answered || 0}/{progress?.total || 0}
                </span>
              )}
              {sectionKey !== 'overall' && (
                <ChevronRightIcon
                  className={`h-3 w-3 opacity-60 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side='bottom'>{tooltipContent}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Expanded question pills */}
      {isExpanded && (
        <div className='flex items-center overflow-visible py-1'>
          {items.map((item, idx) => {
            const globalIndex = allNavItems?.indexOf(item) ?? -1;
            const isFirst = idx === 0;
            const isLast = idx === items.length - 1;
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
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface QuestionPillProps {
  item: NavItem;
  globalIndex: number;
  currentPage: number;
  goToPage: (_index: number) => void;
  comparison: any;
  finalAnswers: any;
  isFirst: boolean;
  isLast: boolean;
}

function QuestionPill({
  item,
  globalIndex,
  currentPage,
  goToPage,
  comparison,
  finalAnswers,
  isFirst,
  isLast,
}: QuestionPillProps) {
  const isCurrentPage = currentPage === globalIndex;
  const isAgreement = isNavItemAgreement(item, comparison);
  const hasAnswer = hasNavItemAnswer(item, finalAnswers);

  const pillStyle = getNavItemPillStyle(isCurrentPage, hasAnswer, isAgreement);
  const tooltip = getNavItemTooltip(item, hasAnswer, isAgreement);

  const displayLabel = (() => {
    if (item.type === NAV_ITEM_TYPES.SECTION_B) {
      return item.key.replace('b', '');
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
      const parts = item.label.split('.');
      return parts.length > 1 ? parts[1] : item.label;
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT) {
      return 'J';
    }
    if (item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
      return 'J';
    }
    return item.label;
  })();

  const isJudgement =
    item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT || item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT;

  const pillSizeClass = isJudgement ? 'h-6 px-2 text-2xs' : 'h-6 w-6 text-2xs';

  let pillSpacingClass = '';
  if (isFirst) pillSpacingClass += 'ml-0.5 ';
  if (isLast) pillSpacingClass += 'mr-0.5 ';
  if (!isFirst && !isLast) pillSpacingClass += 'mx-0.5 ';
  if (isFirst && !isLast) pillSpacingClass += 'mr-0.5 ';
  if (!isFirst && isLast) pillSpacingClass += 'ml-0.5 ';

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type='button'
            onClick={() => goToPage(globalIndex)}
            className={`relative flex items-center justify-center overflow-visible rounded-full font-medium transition-all ${pillSizeClass} ${pillSpacingClass} ${pillStyle}`}
            aria-label={tooltip}
            aria-current={isCurrentPage ? 'page' : undefined}
          >
            {displayLabel}
            {hasAnswer && (
              <span
                className='bg-card absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border-[0.5px] shadow-sm'
                aria-hidden='true'
              >
                <CheckIcon className='h-1.5 w-1.5 text-green-600' />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side='bottom'>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
