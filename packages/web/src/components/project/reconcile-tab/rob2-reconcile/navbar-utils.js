/**
 * Utility functions for ROB-2 Reconciliation Navbar
 * Handles navigation item building, state calculations and styling
 */
import {
  ROB2_CHECKLIST,
  PRELIMINARY_SECTION,
  getActiveDomainKeys,
} from '@corates/shared/checklists/rob2';

/**
 * Navigation item types
 */
export const NAV_ITEM_TYPES = {
  PRELIMINARY: 'preliminary',
  DOMAIN_QUESTION: 'domainQuestion',
  DOMAIN_DIRECTION: 'domainDirection',
  OVERALL_DIRECTION: 'overallDirection',
};

/**
 * Preliminary field keys in order
 */
const PRELIMINARY_FIELD_KEYS = [
  'studyDesign',
  'experimental',
  'comparator',
  'numericalResult',
  'aim',
  'deviationsToAddress',
  'sources',
];

/**
 * Build the full navigation items array based on aim selection
 * @param {boolean} isAdhering - Whether using adhering aim (per-protocol) or assignment aim (ITT)
 * @returns {Array} Array of navigation items
 */
export function buildNavigationItems(isAdhering) {
  const items = [];

  // Preliminary section fields - deviationsToAddress only applies to ADHERING aim
  for (const key of PRELIMINARY_FIELD_KEYS) {
    if (key === 'deviationsToAddress' && !isAdhering) continue;

    const fieldDef = PRELIMINARY_SECTION[key];
    items.push({
      type: NAV_ITEM_TYPES.PRELIMINARY,
      key,
      label: fieldDef?.label || key,
      section: 'Preliminary',
      fieldDef,
    });
  }

  // Active domains based on aim type
  const activeDomains = getActiveDomainKeys(isAdhering);

  for (const domainKey of activeDomains) {
    const domain = ROB2_CHECKLIST[domainKey];
    if (!domain) continue;

    const questions = domain.questions || {};
    const questionKeys = Object.keys(questions);

    // Add each question in the domain
    for (const qKey of questionKeys) {
      const q = questions[qKey];
      items.push({
        type: NAV_ITEM_TYPES.DOMAIN_QUESTION,
        key: qKey,
        domainKey,
        label: q.number || qKey,
        section: domain.name,
        questionDef: q,
      });
    }

    // Add domain direction item (judgement is auto-calculated, direction is manual)
    if (domain.hasDirection) {
      items.push({
        type: NAV_ITEM_TYPES.DOMAIN_DIRECTION,
        key: `${domainKey}_direction`,
        domainKey,
        label: `D${domainKey.replace('domain', '').replace('a', 'A').replace('b', 'B')} Direction`,
        section: domain.name,
        isDirection: true,
      });
    }
  }

  // Overall direction
  items.push({
    type: NAV_ITEM_TYPES.OVERALL_DIRECTION,
    key: 'overall_direction',
    label: 'Overall',
    section: 'Overall',
    isDirection: true,
  });

  return items;
}

/**
 * Get grouped navigation items for display (grouped by section)
 * @param {Array} navItems - Array of navigation items
 * @returns {Array} Array of groups with section name and items
 */
export function getGroupedNavigationItems(navItems) {
  const groups = [];
  let currentGroup = null;

  for (const item of navItems) {
    if (!currentGroup || currentGroup.section !== item.section) {
      currentGroup = { section: item.section, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(item);
  }

  return groups;
}

/**
 * Check if a preliminary field has been answered in the final answers
 * @param {string} key - The field key
 * @param {Object} finalAnswers - The reconciled checklist data
 * @returns {boolean}
 */
export function hasPreliminaryAnswer(key, finalAnswers) {
  const value = finalAnswers?.preliminary?.[key];
  if (key === 'deviationsToAddress') {
    return Array.isArray(value) && value.length > 0;
  }
  if (key === 'sources') {
    return typeof value === 'object' && Object.values(value || {}).some(v => v);
  }
  return value != null && value !== '';
}

/**
 * Check if a domain question has been answered in the final answers
 * @param {string} domainKey - The domain key (domain1, domain2a, etc.)
 * @param {string} questionKey - The question key (d1_1, d2a_1, etc.)
 * @param {Object} finalAnswers - The reconciled checklist data
 * @returns {boolean}
 */
export function hasDomainQuestionAnswer(domainKey, questionKey, finalAnswers) {
  return finalAnswers?.[domainKey]?.answers?.[questionKey]?.answer != null;
}

/**
 * Check if a domain direction has been set
 * @param {string} domainKey - The domain key
 * @param {Object} finalAnswers - The reconciled checklist data
 * @returns {boolean}
 */
export function hasDomainDirection(domainKey, finalAnswers) {
  return finalAnswers?.[domainKey]?.direction != null;
}

/**
 * Check if overall direction has been set
 * @param {Object} finalAnswers - The reconciled checklist data
 * @returns {boolean}
 */
export function hasOverallDirection(finalAnswers) {
  return finalAnswers?.overall?.direction != null;
}

/**
 * Check if a navigation item has been answered/completed
 * @param {Object} navItem - The navigation item
 * @param {Object} finalAnswers - The reconciled checklist data
 * @returns {boolean}
 */
export function hasNavItemAnswer(navItem, finalAnswers) {
  switch (navItem.type) {
    case NAV_ITEM_TYPES.PRELIMINARY:
      return hasPreliminaryAnswer(navItem.key, finalAnswers);
    case NAV_ITEM_TYPES.DOMAIN_QUESTION:
      return hasDomainQuestionAnswer(navItem.domainKey, navItem.key, finalAnswers);
    case NAV_ITEM_TYPES.DOMAIN_DIRECTION:
      return hasDomainDirection(navItem.domainKey, finalAnswers);
    case NAV_ITEM_TYPES.OVERALL_DIRECTION:
      return hasOverallDirection(finalAnswers);
    default:
      return false;
  }
}

/**
 * Check if reviewers agreed on a navigation item
 * @param {Object} navItem - The navigation item
 * @param {Object} comparison - The comparison result from compareChecklists
 * @returns {boolean}
 */
export function isNavItemAgreement(navItem, comparison) {
  if (!comparison) return false;

  switch (navItem.type) {
    case NAV_ITEM_TYPES.PRELIMINARY: {
      const field = comparison.preliminary?.fields?.find(f => f.key === navItem.key);
      return field?.isAgreement ?? false;
    }
    case NAV_ITEM_TYPES.DOMAIN_QUESTION: {
      const domain = comparison.domains?.[navItem.domainKey];
      if (!domain) return false;
      const found = domain.questions?.agreements?.find(a => a.key === navItem.key);
      return !!found;
    }
    case NAV_ITEM_TYPES.DOMAIN_DIRECTION: {
      const domain = comparison.domains?.[navItem.domainKey];
      return domain?.directionMatch ?? false;
    }
    case NAV_ITEM_TYPES.OVERALL_DIRECTION: {
      return comparison.overall?.directionMatch ?? false;
    }
    default:
      return false;
  }
}

/**
 * Get pill styling classes based on item state
 * @param {boolean} isCurrentPage - Is this the active page
 * @param {boolean} hasAnswer - Has this item been answered
 * @param {boolean} isAgreement - Do reviewers agree on this item
 * @returns {string} Tailwind CSS classes
 */
export function getNavItemPillStyle(isCurrentPage, hasAnswer, isAgreement) {
  if (isCurrentPage) {
    return 'bg-blue-600 text-white ring-2 ring-inset ring-blue-300';
  }
  // Use lighter colors - checkmark icon indicates if answered
  return isAgreement ?
      'bg-green-100 text-green-700 hover:bg-green-200'
    : 'bg-amber-100 text-amber-700 hover:bg-amber-200';
}

/**
 * Generate descriptive tooltip for a navigation pill
 * @param {Object} navItem - The navigation item
 * @param {boolean} hasAnswer - Has this item been answered
 * @param {boolean} isAgreement - Do reviewers agree on this item
 * @returns {string} Tooltip text
 */
export function getNavItemTooltip(navItem, hasAnswer, isAgreement) {
  const label = navItem.label;

  if (hasAnswer) {
    return `${label} - Reconciled`;
  }
  if (isAgreement) {
    return `${label} - Reviewers agreed`;
  }
  return `${label} - Reviewers disagree`;
}

/**
 * Get the count of answered items
 * @param {Array} navItems - Array of navigation items
 * @param {Object} finalAnswers - The reconciled checklist data
 * @returns {number}
 */
export function getAnsweredCount(navItems, finalAnswers) {
  return navItems.filter(item => hasNavItemAnswer(item, finalAnswers)).length;
}

/**
 * Get domain display number from domain key
 * @param {string} domainKey - The domain key (domain1, domain2a, etc.)
 * @returns {string} Display number (1, 2A, 2B, 3, etc.)
 */
export function getDomainDisplayNumber(domainKey) {
  return domainKey.replace('domain', '').replace('a', 'A').replace('b', 'B');
}

/**
 * Get section key from section name (for grouping)
 * @param {string} sectionName - The section name from nav item
 * @returns {string} Section key (preliminary, domain1, etc.)
 */
export function getSectionKey(sectionName) {
  if (sectionName === 'Preliminary') return 'preliminary';
  if (sectionName === 'Overall') return 'overall';

  // Domain names like "Domain 1: Bias arising from the randomization process"
  const domainMatch = sectionName.match(/Domain (\d+)/);
  if (domainMatch) {
    const domainNum = domainMatch[1];
    if (domainNum === '2') {
      // Could be 2a or 2b - handled by first item in group
      return 'domain2';
    }
    return `domain${domainNum}`;
  }

  return sectionName;
}

/**
 * Get abbreviated label for a section/domain pill
 * @param {string} sectionKey - The section key
 * @returns {string} Short label (P, D1, D2, etc.)
 */
export function getSectionLabel(sectionKey) {
  if (sectionKey === 'preliminary') return 'P';
  if (sectionKey === 'overall') return 'OA';
  if (sectionKey.startsWith('domain')) {
    const num = sectionKey.replace('domain', '').replace('a', 'A').replace('b', 'B');
    return `D${num}`;
  }
  return sectionKey;
}

/**
 * Get progress stats for each section/domain
 * @param {Array} navItems - All navigation items
 * @param {Object} finalAnswers - Reconciled checklist data
 * @param {Object} comparison - Comparison results
 * @returns {Object} Progress by section key
 */
export function getDomainProgress(navItems, finalAnswers, comparison) {
  const progress = {};
  const groups = getGroupedNavigationItems(navItems);

  for (const group of groups) {
    // Get the actual domain key from the first item in the group
    const firstItem = group.items[0];
    let sectionKey;

    if (firstItem.type === NAV_ITEM_TYPES.PRELIMINARY) {
      sectionKey = 'preliminary';
    } else if (firstItem.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
      sectionKey = 'overall';
    } else if (firstItem.domainKey) {
      sectionKey = firstItem.domainKey;
    } else {
      sectionKey = getSectionKey(group.section);
    }

    let answered = 0;
    let hasDisagreements = false;

    for (const item of group.items) {
      if (hasNavItemAnswer(item, finalAnswers)) {
        answered++;
      }
      if (!isNavItemAgreement(item, comparison)) {
        hasDisagreements = true;
      }
    }

    progress[sectionKey] = {
      answered,
      total: group.items.length,
      hasDisagreements,
      isComplete: answered === group.items.length,
      section: group.section,
      items: group.items,
    };
  }

  return progress;
}

/**
 * Get the domain key that contains a specific nav item index
 * @param {Array} navItems - All navigation items
 * @param {number} pageIndex - The page index
 * @returns {string|null} The section key or null
 */
export function getSectionKeyForPage(navItems, pageIndex) {
  const item = navItems[pageIndex];
  if (!item) return null;

  if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
    return 'preliminary';
  }
  if (item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
    return 'overall';
  }
  if (item.domainKey) {
    return item.domainKey;
  }

  return null;
}

/**
 * Find the first unanswered item index within a section
 * @param {Object} sectionProgress - Progress object for the section
 * @param {Array} navItems - All navigation items
 * @param {Object} finalAnswers - Reconciled checklist data
 * @returns {number} Global index of first unanswered item, or first item if all answered
 */
export function getFirstUnansweredInSection(sectionProgress, navItems, finalAnswers) {
  for (const item of sectionProgress.items) {
    if (!hasNavItemAnswer(item, finalAnswers)) {
      return navItems.indexOf(item);
    }
  }
  // All answered - return first item in section
  return navItems.indexOf(sectionProgress.items[0]);
}
