import { For, Show, createMemo } from 'solid-js';
import { AiOutlineCheck } from 'solid-icons/ai';
import { FiArrowLeft, FiArrowRight } from 'solid-icons/fi';
import { RESPONSE_LABELS } from '@/components/checklist/ROBINSIChecklist/checklist-map.js';
import {
  hasNavItemAnswer,
  isNavItemAgreement,
  getGroupedNavigationItems,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';

/**
 * Get badge style for answer value
 */
function getAnswerBadgeStyle(answer) {
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
function getJudgementBadgeStyle(judgement) {
  if (!judgement) return 'bg-secondary text-muted-foreground';
  if (judgement.toLowerCase().includes('low')) return 'bg-green-100 text-green-700';
  if (judgement.toLowerCase().includes('moderate')) return 'bg-yellow-100 text-yellow-700';
  if (judgement.toLowerCase().includes('serious')) return 'bg-orange-100 text-orange-700';
  if (judgement.toLowerCase().includes('critical')) return 'bg-red-100 text-red-700';
  return 'bg-secondary text-muted-foreground';
}

/**
 * Summary view showing all items grouped by Section B, Domains, and Overall
 *
 * @param {Object} props
 * @param {Object} props.summary - { total, agreed, disagreed, agreementPercentage }
 * @param {Array} props.navItems - Array of navigation items
 * @param {Object} props.comparison - Comparison result from compareChecklists
 * @param {Object} props.finalAnswers - Reconciled checklist data
 * @param {Function} props.onGoToPage - (index) => void
 * @param {Function} props.onBack - Go back to questions view
 * @param {Function} props.onSave - Save reconciliation
 * @param {boolean} props.allAnswered - Whether all items have been answered
 * @param {boolean} props.saving - Whether save is in progress
 * @returns {JSX.Element}
 */
export default function RobinsISummaryView(props) {
  const groupedItems = createMemo(() => getGroupedNavigationItems(props.navItems || []));

  return (
    <div class='bg-card overflow-hidden rounded-lg shadow-lg'>
      {/* Summary Header */}
      <div class='border-border bg-muted border-b p-6'>
        <h2 class='text-foreground mb-4 text-xl font-bold'>Review Summary</h2>

        {/* Stats */}
        <Show when={props.summary}>
          <div class='mb-6 grid grid-cols-4 gap-4'>
            <div class='border-border bg-card rounded-lg border p-3 text-center'>
              <div class='text-secondary-foreground text-2xl font-bold'>{props.summary.total}</div>
              <div class='text-muted-foreground text-xs'>Total Items</div>
            </div>
            <div class='rounded-lg border border-green-200 bg-green-50 p-3 text-center'>
              <div class='text-2xl font-bold text-green-700'>{props.summary.agreed}</div>
              <div class='text-xs text-green-600'>Agreements</div>
            </div>
            <div class='rounded-lg border border-amber-200 bg-amber-50 p-3 text-center'>
              <div class='text-2xl font-bold text-amber-700'>{props.summary.disagreed}</div>
              <div class='text-xs text-amber-600'>Disagreements</div>
            </div>
            <div class='rounded-lg border border-sky-200 bg-sky-50 p-3 text-center'>
              <div class='text-2xl font-bold text-sky-700'>
                {props.summary.agreementPercentage}%
              </div>
              <div class='text-xs text-sky-600'>Agreement Rate</div>
            </div>
          </div>
        </Show>
      </div>

      {/* Grouped Items List */}
      <div class='divide-border divide-y'>
        <For each={groupedItems()}>
          {group => (
            <div>
              {/* Group Header */}
              <div class='bg-secondary px-4 py-2'>
                <h3 class='text-secondary-foreground text-sm font-semibold'>{group.section}</h3>
              </div>

              {/* Group Items */}
              <div class='divide-border-subtle divide-y'>
                <For each={group.items}>
                  {item => {
                    const itemIndex = () => props.navItems?.indexOf(item) ?? -1;
                    const isAgreement = () => isNavItemAgreement(item, props.comparison);
                    const hasAnswer = () => hasNavItemAnswer(item, props.finalAnswers);

                    return (
                      <div
                        class='hover:bg-muted flex cursor-pointer items-center justify-between p-4'
                        onClick={() => props.onGoToPage(itemIndex())}
                      >
                        <div class='flex items-center gap-3'>
                          <span
                            class={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                              isAgreement() ?
                                'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {getItemDisplayNumber(item)}
                          </span>
                          <div>
                            <div class='text-foreground text-sm font-medium'>
                              {getItemLabel(item)}
                            </div>
                            <div class='text-muted-foreground text-xs'>
                              {isAgreement() ? 'Reviewers agreed' : 'Reviewers differed'}
                            </div>
                          </div>
                        </div>
                        <div class='flex items-center gap-3'>
                          <ItemValueBadge
                            item={item}
                            finalAnswers={props.finalAnswers}
                            hasAnswer={hasAnswer()}
                          />
                          <Show when={hasAnswer()}>
                            <span class='flex h-5 w-5 items-center justify-center rounded-full bg-green-100'>
                              <AiOutlineCheck class='h-3 w-3 text-green-600' />
                            </span>
                          </Show>
                          <FiArrowRight class='text-muted-foreground/70 h-4 w-4' />
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Footer Actions */}
      <div class='border-border bg-muted flex items-center justify-between border-t p-6'>
        <button
          onClick={() => props.onBack()}
          class='bg-card text-secondary-foreground hover:bg-secondary flex items-center gap-2 rounded-lg px-4 py-2 font-medium shadow transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none'
        >
          <FiArrowLeft class='h-4 w-4' />
          Back to Questions
        </button>

        <button
          onClick={() => props.onSave()}
          disabled={!props.allAnswered || props.saving}
          class={`flex items-center gap-2 rounded-lg px-6 py-2 font-medium transition-colors focus:outline-none ${
            props.allAnswered && !props.saving ?
              'bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
            : 'bg-border text-muted-foreground cursor-not-allowed'
          }`}
        >
          <Show when={!props.saving} fallback='Saving...'>
            <AiOutlineCheck class='h-4 w-4' />
            Save Reconciled Checklist
          </Show>
        </button>
      </div>
    </div>
  );
}

/**
 * Get display number for item in the summary
 */
function getItemDisplayNumber(item) {
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
function getItemLabel(item) {
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
 * Badge showing the final value for an item
 */
function ItemValueBadge(props) {
  const getValue = () => {
    const item = props.item;
    const finalAnswers = props.finalAnswers;

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
  };

  const value = () => getValue();

  return (
    <Show when={value()} fallback={<span class='text-muted-foreground/70 text-xs'>Not set</span>}>
      {v => (
        <span
          class={`rounded-full px-3 py-1 text-sm font-medium ${
            v().type === 'judgement' ?
              getJudgementBadgeStyle(v().value)
            : getAnswerBadgeStyle(v().value)
          }`}
        >
          {v().type === 'answer' ? `${v().value} - ${RESPONSE_LABELS[v().value]}` : v().value}
        </span>
      )}
    </Show>
  );
}
