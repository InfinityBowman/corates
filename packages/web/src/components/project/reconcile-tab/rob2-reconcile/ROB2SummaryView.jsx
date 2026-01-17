/**
 * ROB2SummaryView - Summary view showing all items before final save
 */

import { Show, For, createMemo } from 'solid-js';
import { FiCheck, FiX, FiChevronRight, FiSave, FiArrowLeft } from 'solid-icons/fi';
import {
  hasNavItemAnswer,
  isNavItemAgreement,
  getGroupedNavigationItems,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';

/**
 * Get display value for a preliminary field
 */
function getPreliminaryDisplayValue(key, finalAnswers) {
  const value = finalAnswers?.preliminary?.[key];
  if (value === null || value === undefined || value === '') return 'Not set';

  if (key === 'deviationsToAddress' && Array.isArray(value)) {
    return value.length > 0 ? `${value.length} selected` : 'None selected';
  }
  if (key === 'sources' && typeof value === 'object') {
    const count = Object.values(value || {}).filter(Boolean).length;
    return count > 0 ? `${count} selected` : 'None selected';
  }
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...';
  }
  return value;
}

/**
 * Get display value for a domain question
 */
function getDomainQuestionDisplayValue(domainKey, questionKey, finalAnswers) {
  const answer = finalAnswers?.[domainKey]?.answers?.[questionKey]?.answer;
  return answer || 'Not set';
}

/**
 * Get display value for a direction
 */
function getDirectionDisplayValue(domainKey, finalAnswers) {
  if (domainKey === 'overall') {
    return finalAnswers?.overall?.direction || 'Not set';
  }
  return finalAnswers?.[domainKey]?.direction || 'Not set';
}

/**
 * ROB2SummaryView - Summary view showing all items before final save
 *
 * @param {Object} props
 * @param {Array} props.navItems - All navigation items
 * @param {Object} props.finalAnswers - The reconciled checklist data
 * @param {Object} props.comparison - The comparison result
 * @param {Object} props.summary - Summary stats { total, agreed, disagreed, agreementPercentage, answered }
 * @param {Function} props.onGoToPage - Navigate to a specific page
 * @param {Function} props.onSave - Save the reconciled checklist
 * @param {Function} props.onBack - Go back to questions view
 * @param {boolean} props.allAnswered - Whether all items have been answered
 * @param {boolean} props.saving - Whether save is in progress
 * @returns {JSX.Element}
 */
export default function ROB2SummaryView(props) {
  const groups = createMemo(() => getGroupedNavigationItems(props.navItems));

  // Get global index for a nav item
  const getItemIndex = item => props.navItems.indexOf(item);

  // Get display value for any nav item
  const getDisplayValue = item => {
    if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
      return getPreliminaryDisplayValue(item.key, props.finalAnswers);
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
      return getDomainQuestionDisplayValue(item.domainKey, item.key, props.finalAnswers);
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION) {
      return getDirectionDisplayValue(item.domainKey, props.finalAnswers);
    }
    if (item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
      return getDirectionDisplayValue('overall', props.finalAnswers);
    }
    return 'N/A';
  };

  return (
    <div class='rounded-xl bg-white shadow-lg'>
      {/* Header */}
      <div class='border-b bg-gray-50 p-6'>
        <h2 class='text-xl font-bold text-gray-900'>Reconciliation Summary</h2>
        <p class='mt-1 text-sm text-gray-600'>
          Review all reconciled items before saving. Click any item to edit.
        </p>
      </div>

      {/* Stats Grid */}
      <div class='grid grid-cols-4 gap-4 border-b p-6'>
        <div class='rounded-lg bg-gray-50 p-4 text-center'>
          <div class='text-2xl font-bold text-gray-900'>{props.summary?.total || 0}</div>
          <div class='text-sm text-gray-600'>Total Items</div>
        </div>
        <div class='rounded-lg bg-green-50 p-4 text-center'>
          <div class='text-2xl font-bold text-green-700'>{props.summary?.agreed || 0}</div>
          <div class='text-sm text-green-600'>Agreements</div>
        </div>
        <div class='rounded-lg bg-amber-50 p-4 text-center'>
          <div class='text-2xl font-bold text-amber-700'>{props.summary?.disagreed || 0}</div>
          <div class='text-sm text-amber-600'>Disagreements</div>
        </div>
        <div class='rounded-lg bg-blue-50 p-4 text-center'>
          <div class='text-2xl font-bold text-blue-700'>
            {props.summary?.agreementPercentage || 0}%
          </div>
          <div class='text-sm text-blue-600'>Agreement Rate</div>
        </div>
      </div>

      {/* Grouped Items List */}
      <div class='divide-y'>
        <For each={groups()}>
          {group => (
            <div>
              {/* Section Header */}
              <div class='bg-gray-50 px-6 py-3'>
                <h3 class='text-sm font-semibold text-gray-700'>{group.section}</h3>
              </div>

              {/* Section Items */}
              <div class='divide-y divide-gray-100'>
                <For each={group.items}>
                  {item => {
                    const hasAnswer = () => hasNavItemAnswer(item, props.finalAnswers);
                    const isAgreement = () => isNavItemAgreement(item, props.comparison);
                    const displayValue = () => getDisplayValue(item);

                    return (
                      <button
                        onClick={() => props.onGoToPage?.(getItemIndex(item))}
                        class='flex w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-gray-50'
                      >
                        {/* Status Icon */}
                        <div
                          class={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                            isAgreement()
                              ? 'bg-green-100 text-green-600'
                              : 'bg-amber-100 text-amber-600'
                          }`}
                        >
                          <Show when={isAgreement()} fallback={<FiX class='h-3.5 w-3.5' />}>
                            <FiCheck class='h-3.5 w-3.5' />
                          </Show>
                        </div>

                        {/* Item Label */}
                        <div class='flex-1 min-w-0'>
                          <div class='flex items-center gap-2'>
                            <span class='text-sm font-medium text-gray-900'>{item.label}</span>
                            <Show when={item.isDirection}>
                              <span class='rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700'>
                                Direction
                              </span>
                            </Show>
                          </div>
                          <Show when={item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && item.questionDef?.text}>
                            <p class='mt-0.5 truncate text-xs text-gray-500'>
                              {item.questionDef.text}
                            </p>
                          </Show>
                        </div>

                        {/* Final Answer Badge */}
                        <div class='flex items-center gap-2'>
                          <Show
                            when={hasAnswer()}
                            fallback={
                              <span class='rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500'>
                                Not set
                              </span>
                            }
                          >
                            <span
                              class={`rounded-full px-2 py-1 text-xs font-medium ${
                                item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION
                                  ? displayValue() === 'Y'
                                    ? 'bg-green-100 text-green-700'
                                    : displayValue() === 'PY'
                                      ? 'bg-lime-100 text-lime-700'
                                      : displayValue() === 'PN'
                                        ? 'bg-amber-100 text-amber-700'
                                        : displayValue() === 'N'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-gray-100 text-gray-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {displayValue()}
                            </span>
                          </Show>

                          {/* Answered Check */}
                          <Show when={hasAnswer()}>
                            <FiCheck class='h-4 w-4 text-green-500' />
                          </Show>
                        </div>

                        {/* Chevron */}
                        <FiChevronRight class='h-4 w-4 shrink-0 text-gray-400' />
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Action Buttons */}
      <div class='flex items-center justify-between border-t p-6'>
        <button
          onClick={() => props.onBack?.()}
          class='flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'
        >
          <FiArrowLeft class='h-4 w-4' />
          Back to Questions
        </button>

        <div class='flex items-center gap-4'>
          <div class='text-sm text-gray-600'>
            {props.summary?.answered || 0} of {props.summary?.total || 0} items reconciled
          </div>

          <button
            onClick={() => props.onSave?.()}
            disabled={!props.allAnswered || props.saving}
            class={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
              props.allAnswered && !props.saving
                ? 'bg-green-600 text-white shadow hover:bg-green-700'
                : 'cursor-not-allowed bg-gray-200 text-gray-400'
            }`}
          >
            <FiSave class='h-4 w-4' />
            {props.saving ? 'Saving...' : 'Save Reconciled Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
}
