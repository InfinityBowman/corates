import { For, createMemo, Show } from 'solid-js';
import { FaSolidArrowRotateLeft } from 'solid-icons/fa';
import { FiCheck, FiAlertTriangle } from 'solid-icons/fi';
import { Tooltip } from '@corates/ui';
import {
  hasNavItemAnswer,
  isNavItemAgreement,
  getNavItemPillStyle,
  getNavItemTooltip,
  getGroupedNavigationItems,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';

/**
 * Navigation bar for Robins-I checklist reconciliation
 * Displays grouped navigation pills for Section B, Domains, and Overall
 *
 * Props:
 * - store: reconciliation navbar store with:
 *   - navItems: array of navigation items
 *   - viewMode: 'questions' or 'summary'
 *   - currentPage: current nav item index
 *   - comparison: comparison result from compareChecklists
 *   - finalAnswers: reconciled checklist data
 *   - setViewMode: function to change view mode
 *   - goToPage: function to go to a specific page index
 *   - onReset: function to reset all reconciliation answers
 *   - sectionBCritical: boolean if Section B indicates critical risk
 */
export default function RobinsINavbar(props) {
  const groupedItems = createMemo(() => getGroupedNavigationItems(props.store.navItems || []));

  return (
    <nav class='flex flex-wrap items-center gap-1 py-1 pl-1' aria-label='Question navigation'>
      {/* Critical Risk Warning */}
      <Show when={props.store.sectionBCritical}>
        <Tooltip content='Section B indicates Critical Risk' placement='bottom' openDelay={200}>
          <div class='mr-2 flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700'>
            <FiAlertTriangle class='h-3 w-3' />
            Critical
          </div>
        </Tooltip>
      </Show>

      {/* Grouped Navigation Pills */}
      <For each={groupedItems()}>
        {group => (
          <div class='flex items-center gap-1'>
            {/* Section separator label */}
            <span class='text-2xs mr-1 font-medium text-gray-400'>
              {getSectionLabel(group.section)}
            </span>
            <For each={group.items}>
              {item => {
                const itemIndex = () => props.store.navItems?.indexOf(item) ?? -1;
                return <NavPill item={item} itemIndex={itemIndex()} store={props.store} />;
              }}
            </For>
            <span class='mx-1 text-gray-300'>|</span>
          </div>
        )}
      </For>

      <SummaryButton store={props.store} />
      <ResetButton onClick={() => props.store.onReset?.()} />
    </nav>
  );
}

/**
 * Get abbreviated section label
 */
function getSectionLabel(section) {
  if (section === 'Section B') return 'B';
  if (section?.includes('Domain 1')) return 'D1';
  if (section?.includes('Domain 2')) return 'D2';
  if (section?.includes('Domain 3')) return 'D3';
  if (section?.includes('Domain 4')) return 'D4';
  if (section?.includes('Domain 5')) return 'D5';
  if (section?.includes('Domain 6')) return 'D6';
  if (section === 'Overall') return '';
  return section?.charAt(0) || '';
}

/**
 * Individual navigation pill button
 */
function NavPill(props) {
  const item = () => props.item;
  const store = () => props.store;

  const isCurrentPage = () =>
    store().viewMode === 'questions' && store().currentPage === props.itemIndex;

  const isAgreement = () => isNavItemAgreement(item(), store().comparison);

  const hasAnswer = () => hasNavItemAnswer(item(), store().finalAnswers);

  const pillStyle = createMemo(() =>
    getNavItemPillStyle(isCurrentPage(), hasAnswer(), isAgreement()),
  );

  const tooltip = createMemo(() => getNavItemTooltip(item(), hasAnswer(), isAgreement()));

  // Determine pill size based on label length
  const isJudgement = () => item().isJudgement;
  const pillSizeClass = () => (isJudgement() ? 'h-7 px-2 text-[10px]' : 'h-7 w-7 text-xs');

  return (
    <Tooltip content={tooltip()} placement='bottom' openDelay={200}>
      <button
        onClick={() => store().goToPage?.(props.itemIndex)}
        class={`relative flex items-center justify-center rounded-full font-medium transition-all ${pillSizeClass()} ${pillStyle()}`}
        aria-label={tooltip()}
        aria-current={isCurrentPage() ? 'page' : undefined}
      >
        {getDisplayLabel(item())}
        <Show when={hasAnswer()}>
          <span
            class='absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-[0.5px] bg-white shadow-sm'
            aria-hidden='true'
          >
            <FiCheck class='h-2 w-2 text-green-600' />
          </span>
        </Show>
      </button>
    </Tooltip>
  );
}

/**
 * Get display label for nav item
 */
function getDisplayLabel(item) {
  if (item.type === NAV_ITEM_TYPES.SECTION_B) {
    return item.key.toUpperCase().replace('B', '');
  }
  if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
    // Show just the question number part (e.g., "1" from "1.1")
    const parts = item.label.split('.');
    return parts.length > 1 ? parts[1] : item.label;
  }
  if (item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT) {
    return 'J';
  }
  if (item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
    return 'OA';
  }
  return item.label;
}

/**
 * Summary view button
 */
function SummaryButton(props) {
  const isActive = () => props.store.viewMode === 'summary';

  const buttonStyle = createMemo(() =>
    isActive() ?
      'bg-blue-600 text-white ring-2 ring-blue-300'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
  );

  return (
    <Tooltip content='View summary of all items' placement='bottom' openDelay={200}>
      <button
        onClick={() => props.store.setViewMode?.('summary')}
        class={`h-7 rounded-full px-3 text-xs font-medium transition-all ${buttonStyle()}`}
        aria-label='View summary'
        aria-current={isActive() ? 'page' : undefined}
      >
        Summary
      </button>
    </Tooltip>
  );
}

/**
 * Reset button to clear all reconciliation answers
 */
function ResetButton(props) {
  return (
    <Tooltip content='Reset all answers' placement='bottom' openDelay={200}>
      <button
        onClick={() => props.onClick?.()}
        class='flex h-7 items-center gap-1 rounded-full bg-red-100 px-2 text-xs font-medium text-red-700 transition-all hover:bg-red-200'
        aria-label='Reset reconciliation'
      >
        <FaSolidArrowRotateLeft size={10} />
        Reset
      </button>
    </Tooltip>
  );
}
