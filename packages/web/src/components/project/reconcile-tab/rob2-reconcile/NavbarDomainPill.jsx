import { For, createMemo, Show } from 'solid-js';
import { FiChevronDown, FiChevronRight, FiCheck } from 'solid-icons/fi';
import { Tooltip, CollapsiblePrimitive as Collapsible } from '@corates/ui';
import {
  getSectionLabel,
  hasNavItemAnswer,
  isNavItemAgreement,
  getNavItemPillStyle,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';

/**
 * Domain pill that expands inline to show question pills
 * When collapsed: shows label + progress (e.g., "D1 2/5")
 * When expanded: shows label + question pills inline (e.g., "D1 [1][2][3][4][5]")
 *
 * @param {Object} props
 * @param {string} props.sectionKey - Section key (e.g., 'domain1', 'preliminary', 'overall')
 * @param {Object} props.progress - Progress object with answered, total, hasDisagreements, isComplete, items
 * @param {boolean} props.isExpanded - Whether this domain is currently expanded
 * @param {boolean} props.isCurrentDomain - Whether current page is in this domain
 * @param {Function} props.onClick - Click handler for the label/collapse button
 * @param {Array} props.allNavItems - All navigation items (for global index lookup)
 * @param {number} props.currentPage - Current page index
 * @param {Function} props.goToPage - Navigate to page function
 * @param {Object} props.comparison - Comparison results
 * @param {Object} props.finalAnswers - Reconciled checklist data
 */
export default function NavbarDomainPill(props) {
  const label = () => getSectionLabel(props.sectionKey);

  // Container style - wraps everything in one connected pill
  const containerStyle = createMemo(() => {
    let base = 'flex items-center rounded-md transition-all bg-gray-100 overflow-visible ';

    // Subtle ring for current domain only (when collapsed)
    if (!props.isExpanded && props.isCurrentDomain) {
      base += 'ring-2 ring-blue-300 ';
    }

    return base;
  });

  // Label button style
  const labelStyle = createMemo(() => {
    let base =
      'flex items-center gap-1 rounded-md px-2 py-2 text-xs font-medium cursor-pointer select-none transition-all text-gray-700 ';

    if (props.isExpanded) {
      // When expanded, label is slightly darker to stand out
      base += 'bg-gray-200 hover:bg-gray-300 ';
    } else {
      base += 'hover:bg-gray-200 ';
    }

    return base;
  });

  const tooltipContent = createMemo(() => {
    const section = props.progress?.section || props.sectionKey;
    const answered = props.progress?.answered || 0;
    const total = props.progress?.total || 0;

    if (answered === total && total > 0) {
      return `${section}: Complete (${total}/${total})`;
    }
    return `${section}: ${answered}/${total}`;
  });

  return (
    <Collapsible.Root open={props.isExpanded} collapsedWidth={0} class={containerStyle()}>
      {/* Label/collapse button */}
      <Tooltip content={tooltipContent()} placement='bottom' openDelay={300}>
        <button type='button' onClick={() => props.onClick?.()} class={labelStyle()}>
          <span class='font-semibold'>{label()}</span>
          {/* Only show progress count when collapsed */}
          <Show when={!props.isExpanded}>
            <span class='text-2xs opacity-80'>
              {props.progress?.answered || 0}/{props.progress?.total || 0}
            </span>
          </Show>
          <Show when={props.sectionKey !== 'overall'}>
            {props.isExpanded ?
              <FiChevronDown class='h-3 w-3 opacity-60' />
            : <FiChevronRight class='h-3 w-3 opacity-60' />}
          </Show>
        </button>
      </Tooltip>

      {/* Animated expanded question pills */}
      <Collapsible.Content class='collapsible-horizontal flex items-center overflow-visible py-1'>
        <For each={props.progress?.items || []}>
          {(item, idx) => {
            const globalIndex = () => props.allNavItems?.indexOf(item) ?? -1;
            const itemCount = () => props.progress?.items?.length || 0;
            const isFirst = () => idx() === 0;
            const isLast = () => idx() === itemCount() - 1;
            return (
              <QuestionPill
                item={item}
                globalIndex={globalIndex()}
                currentPage={props.currentPage}
                goToPage={props.goToPage}
                comparison={props.comparison}
                finalAnswers={props.finalAnswers}
                isFirst={isFirst()}
                isLast={isLast()}
              />
            );
          }}
        </For>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

/**
 * Individual question pill within expanded domain
 */
function QuestionPill(props) {
  const isCurrentPage = () => props.currentPage === props.globalIndex;
  const isAgreement = () => isNavItemAgreement(props.item, props.comparison);
  const hasAnswer = () => hasNavItemAnswer(props.item, props.finalAnswers);

  const pillStyle = createMemo(() =>
    getNavItemPillStyle(isCurrentPage(), hasAnswer(), isAgreement()),
  );

  const tooltip = createMemo(() => {
    const item = props.item;
    const answered = hasAnswer();
    const agreement = isAgreement();

    let status = '';
    if (answered) {
      status = 'Reconciled';
    } else if (agreement) {
      status = 'Agreement (not yet confirmed)';
    } else {
      status = 'Needs reconciliation';
    }

    return `${item.label}: ${status}`;
  });

  const displayLabel = () => {
    const item = props.item;
    if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
      // Show first 2 chars of key (e.g., "St" for studyDesign, "Ai" for aim)
      return item.key?.substring(0, 2) || '?';
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
      // Extract question number like "1.1" -> "1"
      const parts = item.label?.split('.') || [];
      return parts.length > 1 ? parts[1] : item.label;
    }
    if (item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION || item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
      return 'D';
    }
    return item.label || '?';
  };

  const isDirection = () =>
    props.item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION ||
    props.item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION;

  const pillSizeClass = () => (isDirection() ? 'h-6 px-2 text-2xs' : 'h-6 w-6 text-2xs');

  const pillSpacingClass = () => {
    let spacing = '';
    if (props.isFirst) spacing += 'ml-0.5 ';
    if (props.isLast) spacing += 'mr-0.5 ';
    if (!props.isFirst && !props.isLast) spacing += 'mx-0.5 ';
    if (props.isFirst && !props.isLast) spacing += 'mr-0.5 ';
    if (!props.isFirst && props.isLast) spacing += 'ml-0.5 ';
    return spacing;
  };

  return (
    <Tooltip content={tooltip()} placement='bottom' openDelay={200}>
      <button
        type='button'
        onClick={() => props.goToPage?.(props.globalIndex)}
        class={`relative flex items-center justify-center overflow-visible rounded-full font-medium transition-all ${pillSizeClass()} ${pillSpacingClass()} ${pillStyle()}`}
        aria-label={tooltip()}
        aria-current={isCurrentPage() ? 'page' : undefined}
      >
        {displayLabel()}
        <Show when={hasAnswer()}>
          <span
            class='absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border-[0.5px] bg-white shadow-sm'
            aria-hidden='true'
          >
            <FiCheck class='h-1.5 w-1.5 text-green-600' />
          </span>
        </Show>
      </button>
    </Tooltip>
  );
}
