import { For, createMemo, Show } from 'solid-js';
import { FaSolidArrowRotateLeft } from 'solid-icons/fa';
import { FiAlertTriangle } from 'solid-icons/fi';
import {
  Tooltip,
  TooltipTrigger,
  TooltipPositioner,
  TooltipContent,
} from '@/components/ui/tooltip';
import NavbarDomainPill from './NavbarDomainPill.jsx';
import {
  getDomainProgress,
  getSectionKeyForPage,
  getFirstUnansweredInSection,
} from './navbar-utils.js';

/**
 * Navigation bar for Robins-I checklist reconciliation
 * Uses expandable domain pills with accordion behavior (only one expanded at a time)
 *
 * Props:
 * - store: reconciliation navbar store with:
 *   - navItems: array of navigation items
 *   - viewMode: 'questions' or 'summary'
 *   - currentPage: current nav item index
 *   - comparison: comparison result from compareChecklists
 *   - finalAnswers: reconciled checklist data
 *   - expandedDomain: which domain is currently expanded (sectionKey or null)
 *   - setViewMode: function to change view mode
 *   - goToPage: function to go to a specific page index
 *   - setExpandedDomain: function to set which domain is expanded
 *   - onReset: function to reset all reconciliation answers
 *   - sectionBCritical: boolean if Section B indicates critical risk
 */
export default function RobinsINavbar(props) {
  // Calculate progress for all domains/sections
  const domainProgress = createMemo(() =>
    getDomainProgress(props.store.navItems || [], props.store.finalAnswers, props.store.comparison),
  );

  // Get ordered section keys from progress
  const sectionKeys = createMemo(() => Object.keys(domainProgress()));

  // Current page's section
  const currentSectionKey = createMemo(() =>
    getSectionKeyForPage(props.store.navItems || [], props.store.currentPage),
  );

  // Handle domain pill click - toggle expand or navigate
  function handleDomainClick(sectionKey) {
    const progress = domainProgress()[sectionKey];
    const isCurrentlyExpanded = props.store.expandedDomain === sectionKey;

    // If already expanded, do nothing (don't re-trigger animation)
    if (isCurrentlyExpanded) {
      return;
    }

    // Expand and navigate to first unanswered (or first item if all complete)
    props.store.setExpandedDomain?.(sectionKey);

    // Navigate to first unanswered item in this section
    if (progress && props.store.navItems) {
      const targetIndex = getFirstUnansweredInSection(
        progress,
        props.store.navItems,
        props.store.finalAnswers,
      );
      if (targetIndex >= 0) {
        props.store.goToPage?.(targetIndex);
      }
    }
  }

  // Handle navigation to a specific page - auto-expand its domain
  function handleGoToPage(pageIndex) {
    const sectionKey = getSectionKeyForPage(props.store.navItems || [], pageIndex);
    if (sectionKey && sectionKey !== props.store.expandedDomain) {
      props.store.setExpandedDomain?.(sectionKey);
    }
    props.store.goToPage?.(pageIndex);
  }

  return (
    <nav class='flex items-center gap-1 px-1 py-1.5' aria-label='Question navigation'>
      {/* Critical Risk Warning */}
      <Show when={props.store.sectionBCritical}>
        <Tooltip openDelay={200} positioning={{ placement: 'bottom' }}>
          <TooltipTrigger>
            <div class='mr-1 flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700'>
              <FiAlertTriangle class='h-3 w-3' />
              Critical
            </div>
          </TooltipTrigger>
          <TooltipPositioner>
            <TooltipContent>Section B indicates Critical Risk</TooltipContent>
          </TooltipPositioner>
        </Tooltip>
      </Show>

      {/* Domain pills with expandable groups */}
      <For each={sectionKeys()}>
        {sectionKey => {
          const progress = () => domainProgress()[sectionKey];
          const isExpanded = () => props.store.expandedDomain === sectionKey;
          const isCurrentDomain = () => currentSectionKey() === sectionKey;

          return (
            <div class='shrink-0'>
              <NavbarDomainPill
                sectionKey={sectionKey}
                progress={progress()}
                isExpanded={isExpanded()}
                isCurrentDomain={isCurrentDomain()}
                onClick={() => handleDomainClick(sectionKey)}
                allNavItems={props.store.navItems}
                currentPage={props.store.currentPage}
                goToPage={handleGoToPage}
                comparison={props.store.comparison}
                finalAnswers={props.store.finalAnswers}
              />
            </div>
          );
        }}
      </For>

      {/* Separator before summary/reset */}
      <span class='mx-1 shrink-0 text-gray-300'>|</span>

      <div class='flex shrink-0 items-center gap-1'>
        <SummaryButton store={props.store} />
        <ResetButton onClick={() => props.store.onReset?.()} />
      </div>
    </nav>
  );
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
    <Tooltip openDelay={200} positioning={{ placement: 'bottom' }}>
      <TooltipTrigger>
        <button
          type='button'
          onClick={() => props.store.setViewMode?.('summary')}
          class={`h-7 rounded-full px-3 text-xs font-medium transition-all ${buttonStyle()}`}
          aria-label='View summary'
          aria-current={isActive() ? 'page' : undefined}
        >
          Summary
        </button>
      </TooltipTrigger>
      <TooltipPositioner>
        <TooltipContent>View summary of all items</TooltipContent>
      </TooltipPositioner>
    </Tooltip>
  );
}

/**
 * Reset button to clear all reconciliation answers
 */
function ResetButton(props) {
  return (
    <Tooltip openDelay={200} positioning={{ placement: 'bottom' }}>
      <TooltipTrigger>
        <button
          type='button'
          onClick={() => props.onClick?.()}
          class='flex h-7 items-center gap-1 rounded-full bg-red-100 px-2 text-xs font-medium text-red-700 transition-all hover:bg-red-200'
          aria-label='Reset reconciliation'
        >
          <FaSolidArrowRotateLeft size={10} />
          Reset
        </button>
      </TooltipTrigger>
      <TooltipPositioner>
        <TooltipContent>Reset all final answers</TooltipContent>
      </TooltipPositioner>
    </Tooltip>
  );
}
