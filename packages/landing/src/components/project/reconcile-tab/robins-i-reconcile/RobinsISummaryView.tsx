import { useMemo } from 'react';
import { CheckIcon, ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { RESPONSE_LABELS } from '@/components/checklist/ROBINSIChecklist/checklist-map';
import {
  hasNavItemAnswer,
  isNavItemAgreement,
  getGroupedNavigationItems,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';

/**
 * Get badge style for answer value
 */
function getAnswerBadgeStyle(answer: string | null | undefined): string {
  if (!answer) return 'bg-secondary text-muted-foreground';
  switch (answer) {
    case 'Y':
    case 'SY':
      return 'bg-green-100 text-green-700';
    case 'PY':
    case 'WY':
      return 'bg-lime-100 text-lime-700';
    case 'PN':
    case 'WN':
      return 'bg-amber-100 text-amber-700';
    case 'N':
    case 'SN':
      return 'bg-red-100 text-red-700';
    case 'NI':
      return 'bg-secondary text-muted-foreground';
    default:
      return 'bg-secondary text-muted-foreground';
  }
}

/**
 * Get badge style for judgement value
 */
function getJudgementBadgeStyle(judgement: string | null | undefined): string {
  if (!judgement) return 'bg-secondary text-muted-foreground';
  if (judgement.toLowerCase().includes('low')) return 'bg-green-100 text-green-700';
  if (judgement.toLowerCase().includes('moderate')) return 'bg-yellow-100 text-yellow-700';
  if (judgement.toLowerCase().includes('serious')) return 'bg-orange-100 text-orange-700';
  if (judgement.toLowerCase().includes('critical')) return 'bg-red-100 text-red-700';
  return 'bg-secondary text-muted-foreground';
}

/**
 * Get display number for item in the summary
 */
function getItemDisplayNumber(item: any): string {
  if (item.type === NAV_ITEM_TYPES.SECTION_B) {
    return item.key.toUpperCase();
  }
  if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
    return item.label;
  }
  if (item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT) {
    return 'J';
  }
  if (item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
    return 'OA';
  }
  return '?';
}

/**
 * Get label for item
 */
function getItemLabel(item: any): string {
  if (item.type === NAV_ITEM_TYPES.SECTION_B) {
    return `Question ${item.key.toUpperCase()}`;
  }
  if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
    return `Question ${item.label}`;
  }
  if (item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT) {
    return 'Domain Judgement';
  }
  if (item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
    return 'Overall Judgement';
  }
  return item.label;
}

/**
 * Get value info for an item from final answers
 */
function getItemValue(
  item: any,
  finalAnswers: any,
): { type: 'answer' | 'judgement'; value: string } | null {
  if (item.type === NAV_ITEM_TYPES.SECTION_B) {
    const answer = finalAnswers?.sectionB?.[item.key]?.answer;
    if (!answer) return null;
    return { type: 'answer', value: answer };
  }

  if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
    const answer = finalAnswers?.[item.domainKey]?.answers?.[item.key]?.answer;
    if (!answer) return null;
    return { type: 'answer', value: answer };
  }

  if (item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT) {
    const judgement = finalAnswers?.[item.domainKey]?.judgement;
    if (!judgement) return null;
    return { type: 'judgement', value: judgement };
  }

  if (item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
    const judgement = finalAnswers?.overall?.judgement;
    if (!judgement) return null;
    return { type: 'judgement', value: judgement };
  }

  return null;
}

interface SummaryStats {
  total: number;
  agreed: number;
  disagreed: number;
  agreementPercentage: number;
  answered: number;
}

interface RobinsISummaryViewProps {
  navItems: any[];
  finalAnswers: any;
  comparison: any;
  summary: SummaryStats;
  onGoToPage: (_index: number) => void;
  onSave: () => void;
  onBack: () => void;
  allAnswered: boolean;
  saving: boolean;
}

export function RobinsISummaryView({
  navItems,
  finalAnswers,
  comparison,
  summary,
  onGoToPage,
  onSave,
  onBack,
  allAnswered,
  saving,
}: RobinsISummaryViewProps) {
  const groupedItems = useMemo(() => getGroupedNavigationItems(navItems || []), [navItems]);

  return (
    <div className='bg-card overflow-hidden rounded-lg shadow-lg'>
      {/* Summary Header */}
      <div className='border-border bg-muted border-b p-6'>
        <h2 className='text-foreground mb-4 text-xl font-bold'>Review Summary</h2>

        {/* Stats */}
        {summary && (
          <div className='mb-6 grid grid-cols-4 gap-4'>
            <div className='border-border bg-card rounded-lg border p-3 text-center'>
              <div className='text-secondary-foreground text-2xl font-bold'>{summary.total}</div>
              <div className='text-muted-foreground text-xs'>Total Items</div>
            </div>
            <div className='rounded-lg border border-green-200 bg-green-50 p-3 text-center'>
              <div className='text-2xl font-bold text-green-700'>{summary.agreed}</div>
              <div className='text-xs text-green-600'>Agreements</div>
            </div>
            <div className='rounded-lg border border-amber-200 bg-amber-50 p-3 text-center'>
              <div className='text-2xl font-bold text-amber-700'>{summary.disagreed}</div>
              <div className='text-xs text-amber-600'>Disagreements</div>
            </div>
            <div className='rounded-lg border border-sky-200 bg-sky-50 p-3 text-center'>
              <div className='text-2xl font-bold text-sky-700'>{summary.agreementPercentage}%</div>
              <div className='text-xs text-sky-600'>Agreement Rate</div>
            </div>
          </div>
        )}
      </div>

      {/* Grouped Items List */}
      <div className='divide-border divide-y'>
        {groupedItems.map(group => (
          <div key={group.section}>
            {/* Group Header */}
            <div className='bg-secondary px-4 py-2'>
              <h3 className='text-secondary-foreground text-sm font-semibold'>{group.section}</h3>
            </div>

            {/* Group Items */}
            <div className='divide-border-subtle divide-y'>
              {group.items.map((item: any) => {
                const itemIndex = navItems?.indexOf(item) ?? -1;
                const agreement = isNavItemAgreement(item, comparison);
                const answered = hasNavItemAnswer(item, finalAnswers);
                const value = getItemValue(item, finalAnswers);

                return (
                  <div
                    key={item.key}
                    className='hover:bg-muted flex cursor-pointer items-center justify-between p-4'
                    onClick={() => onGoToPage(itemIndex)}
                  >
                    <div className='flex items-center gap-3'>
                      <span
                        className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${
                          agreement ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {getItemDisplayNumber(item)}
                      </span>
                      <div>
                        <div className='text-foreground text-sm font-medium'>
                          {getItemLabel(item)}
                        </div>
                        <div className='text-muted-foreground text-xs'>
                          {agreement ? 'Reviewers agreed' : 'Reviewers differed'}
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-3'>
                      {value ?
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${
                            value.type === 'judgement' ?
                              getJudgementBadgeStyle(value.value)
                            : getAnswerBadgeStyle(value.value)
                          }`}
                        >
                          {value.type === 'answer' ?
                            `${value.value} - ${(RESPONSE_LABELS as Record<string, string>)[value.value]}`
                          : value.value}
                        </span>
                      : <span className='text-muted-foreground/70 text-xs'>Not set</span>}
                      {answered && (
                        <span className='flex size-5 items-center justify-center rounded-full bg-green-100'>
                          <CheckIcon className='size-3 text-green-600' />
                        </span>
                      )}
                      <ArrowRightIcon className='text-muted-foreground/70 size-4' />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className='border-border bg-muted flex items-center justify-between border-t p-6'>
        <button
          onClick={onBack}
          className='bg-card text-secondary-foreground hover:bg-secondary flex items-center gap-2 rounded-lg px-4 py-2 font-medium shadow transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none'
        >
          <ArrowLeftIcon className='size-4' />
          Back to Questions
        </button>

        <button
          onClick={onSave}
          disabled={!allAnswered || saving}
          className={`flex items-center gap-2 rounded-lg px-6 py-2 font-medium transition-colors focus:outline-none ${
            allAnswered && !saving ?
              'bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
            : 'bg-border text-muted-foreground cursor-not-allowed'
          }`}
        >
          {saving ?
            'Saving...'
          : <>
              <CheckIcon className='size-4' />
              Save Reconciled Checklist
            </>
          }
        </button>
      </div>
    </div>
  );
}
