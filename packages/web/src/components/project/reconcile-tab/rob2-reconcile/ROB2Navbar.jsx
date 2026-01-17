/**
 * ROB2Navbar - Domain-grouped, expandable navbar for ROB-2 reconciliation
 */

import { Show, For, createMemo } from 'solid-js';
import { FiCheck, FiAlertTriangle, FiRotateCcw, FiFileText } from 'solid-icons/fi';
import {
  hasNavItemAnswer,
  isNavItemAgreement,
  getDomainProgress,
  getFirstUnansweredInSection,
  getSectionLabel,
  getNavItemPillStyle,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';

/**
 * ROB2Navbar - Navigation bar for ROB-2 reconciliation
 *
 * @param {Object} props
 * @param {Object} props.store - Navbar store with:
 *   - navItems: array of navigation items
 *   - viewMode: 'questions' or 'summary'
 *   - currentPage: current nav item index
 *   - comparison: comparison result
 *   - finalAnswers: reconciled checklist data
 *   - aimMismatch: whether there's an aim mismatch
 *   - expandedDomain: which domain is currently expanded
 *   - setViewMode: function to change view mode
 *   - goToPage: function to go to a specific page index
 *   - setExpandedDomain: function to set which domain is expanded
 *   - onReset: function to reset all reconciliation answers
 * @returns {JSX.Element}
 */
export default function ROB2Navbar(props) {
  // Calculate progress for each section/domain
  const progress = createMemo(() =>
    getDomainProgress(props.store.navItems || [], props.store.finalAnswers, props.store.comparison),
  );

  // Get unique section keys in order
  const sectionKeys = createMemo(() => {
    const keys = [];
    const seen = new Set();
    const navItems = props.store.navItems || [];

    for (const item of navItems) {
      let key;
      if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
        key = 'preliminary';
      } else if (item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
        key = 'overall';
      } else if (item.domainKey) {
        key = item.domainKey;
      }

      if (key && !seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
    return keys;
  });

  // Handle section click - expand and navigate to first unanswered
  const handleSectionClick = sectionKey => {
    if (props.store.expandedDomain === sectionKey) {
      // Click on already expanded - collapse
      props.store.setExpandedDomain?.(null);
    } else {
      // Expand and navigate to first unanswered
      props.store.setExpandedDomain?.(sectionKey);
      const sectionProgress = progress()[sectionKey];
      if (sectionProgress) {
        const index = getFirstUnansweredInSection(
          sectionProgress,
          props.store.navItems || [],
          props.store.finalAnswers,
        );
        props.store.goToPage?.(index);
      }
    }
  };

  // Handle item click
  const handleItemClick = item => {
    const navItems = props.store.navItems || [];
    const index = navItems.indexOf(item);
    if (index >= 0) {
      props.store.goToPage?.(index);
    }
  };

  return (
    <div class='sticky top-0 z-10 flex items-center gap-2 overflow-x-auto bg-white p-3 shadow'>
      {/* Aim Mismatch Warning */}
      <Show when={props.store.aimMismatch}>
        <div
          class='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600'
          title='Aim mismatch detected'
        >
          <FiAlertTriangle class='h-4 w-4' />
        </div>
      </Show>

      {/* Section Pills */}
      <For each={sectionKeys()}>
        {sectionKey => {
          const sectionProgress = () => progress()[sectionKey];
          const isExpanded = () => props.store.expandedDomain === sectionKey;
          const label = () => getSectionLabel(sectionKey);

          // Section status colors
          const getSectionStyle = () => {
            const sp = sectionProgress();
            if (!sp) return 'bg-gray-100 text-gray-600';
            const navItems = props.store.navItems || [];

            const isCurrentSection = sp.items.some(
              (_, i) => navItems.indexOf(sp.items[i]) === props.store.currentPage,
            );

            if (isCurrentSection) {
              return 'bg-blue-600 text-white ring-2 ring-blue-300';
            }
            if (sp.isComplete) {
              return 'bg-green-100 text-green-700';
            }
            if (sp.hasDisagreements) {
              return 'bg-amber-100 text-amber-700';
            }
            return 'bg-gray-100 text-gray-600';
          };

          return (
            <div class='flex items-center gap-1'>
              {/* Section Pill */}
              <button
                onClick={() => handleSectionClick(sectionKey)}
                class={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${getSectionStyle()}`}
                title={sectionProgress()?.section}
              >
                <span>{label()}</span>
                <span class='text-xs opacity-70'>
                  {sectionProgress()?.answered}/{sectionProgress()?.total}
                </span>
                <Show when={sectionProgress()?.isComplete}>
                  <FiCheck class='h-3.5 w-3.5' />
                </Show>
              </button>

              {/* Expanded Items */}
              <Show when={isExpanded()}>
                <div class='flex items-center gap-1 ml-1'>
                  <For each={sectionProgress()?.items || []}>
                    {item => {
                      const navItems = props.store.navItems || [];
                      const itemIndex = navItems.indexOf(item);
                      const isCurrent = () => itemIndex === props.store.currentPage;
                      const hasAnswer = () => hasNavItemAnswer(item, props.store.finalAnswers);
                      const isAgreement = () => isNavItemAgreement(item, props.store.comparison);

                      // Get short label for item
                      const shortLabel = () => {
                        if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
                          return item.label?.substring(0, 2) || '?';
                        }
                        if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
                          // Extract question number like "1.1" -> "1"
                          const num = item.label?.split('.')?.[1] || item.label;
                          return num;
                        }
                        if (
                          item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION ||
                          item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION
                        ) {
                          return 'D'; // Direction
                        }
                        return '?';
                      };

                      return (
                        <button
                          onClick={() => handleItemClick(item)}
                          class={`relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all ${getNavItemPillStyle(isCurrent(), hasAnswer(), isAgreement())}`}
                          title={item.label}
                        >
                          {shortLabel()}
                          <Show when={hasAnswer()}>
                            <div class='absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-green-500 text-white'>
                              <FiCheck class='h-2 w-2' />
                            </div>
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          );
        }}
      </For>

      {/* Spacer */}
      <div class='flex-1' />

      {/* Summary Button */}
      <button
        onClick={() => props.store.setViewMode?.('summary')}
        class={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          props.store.viewMode === 'summary'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <FiFileText class='h-4 w-4' />
        Summary
      </button>

      {/* Reset Button */}
      <button
        onClick={() => props.store.onReset?.()}
        class='flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-red-100 hover:text-red-700'
        title='Reset all reconciliation'
      >
        <FiRotateCcw class='h-4 w-4' />
      </button>
    </div>
  );
}
