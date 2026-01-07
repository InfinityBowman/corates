import { For, Show, createMemo } from 'solid-js';
import { AiOutlineArrowRight, AiOutlineCheck, AiOutlineArrowLeft } from 'solid-icons/ai';
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
  if (!answer) return 'bg-gray-100 text-gray-600';
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
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

/**
 * Get badge style for judgement value
 */
function getJudgementBadgeStyle(judgement) {
  if (!judgement) return 'bg-gray-100 text-gray-600';
  if (judgement.toLowerCase().includes('low')) return 'bg-green-100 text-green-700';
  if (judgement.toLowerCase().includes('moderate')) return 'bg-yellow-100 text-yellow-700';
  if (judgement.toLowerCase().includes('serious')) return 'bg-orange-100 text-orange-700';
  if (judgement.toLowerCase().includes('critical')) return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
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
    <div class='overflow-hidden rounded-lg bg-white shadow-lg'>
      {/* Summary Header */}
      <div class='border-b border-gray-200 bg-gray-50 p-6'>
        <h2 class='mb-4 text-xl font-bold text-gray-900'>Review Summary</h2>

        {/* Stats */}
        <Show when={props.summary}>
          <div class='mb-6 grid grid-cols-4 gap-4'>
            <div class='rounded-lg border border-gray-200 bg-white p-3 text-center'>
              <div class='text-2xl font-bold text-gray-700'>{props.summary.total}</div>
              <div class='text-xs text-gray-500'>Total Items</div>
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
      <div class='divide-y divide-gray-200'>
        <For each={groupedItems()}>
          {group => (
            <div>
              {/* Group Header */}
              <div class='bg-gray-100 px-4 py-2'>
                <h3 class='text-sm font-semibold text-gray-700'>{group.section}</h3>
              </div>

              {/* Group Items */}
              <div class='divide-y divide-gray-100'>
                <For each={group.items}>
                  {item => {
                    const itemIndex = () => props.navItems?.indexOf(item) ?? -1;
                    const isAgreement = () => isNavItemAgreement(item, props.comparison);
                    const hasAnswer = () => hasNavItemAnswer(item, props.finalAnswers);

                    return (
                      <div
                        class='flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50'
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
                            <div class='text-sm font-medium text-gray-900'>
                              {getItemLabel(item)}
                            </div>
                            <div class='text-xs text-gray-500'>
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
                          <AiOutlineArrowRight class='h-4 w-4 text-gray-400' />
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
      <div class='flex items-center justify-between border-t border-gray-200 bg-gray-50 p-6'>
        <button
          onClick={() => props.onBack()}
          class='flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-gray-700 shadow transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none'
        >
          <AiOutlineArrowLeft class='h-4 w-4' />
          Back to Questions
        </button>

        <button
          onClick={() => props.onSave()}
          disabled={!props.allAnswered || props.saving}
          class={`flex items-center gap-2 rounded-lg px-6 py-2 font-medium transition-colors focus:outline-none ${
            props.allAnswered && !props.saving ?
              'bg-blue-600 text-white shadow hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
            : 'cursor-not-allowed bg-gray-300 text-gray-500'
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
    <Show when={value()} fallback={<span class='text-xs text-gray-400'>Not set</span>}>
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
