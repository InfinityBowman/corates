/**
 * Utility functions for Robins-I Reconciliation Navbar
 * Handles navigation item building, state calculations and styling
 */
import {
  SECTION_B,
  getDomainQuestions,
  getActiveDomainKeys,
  ROBINS_I_CHECKLIST,
} from '@/components/checklist/ROBINSIChecklist/checklist-map.js';

/**
 * Navigation item types
 */
export const NAV_ITEM_TYPES = {
  SECTION_B: 'sectionB',
  DOMAIN_QUESTION: 'domainQuestion',
  DOMAIN_JUDGEMENT: 'domainJudgement',
  OVERALL_JUDGEMENT: 'overallJudgement',
};

/**
 * Build the full navigation items array based on protocol type
 * @param {boolean} isPerProtocol - Whether using per-protocol (domain 1B) or ITT (domain 1A)
 * @returns {Array} Array of navigation items
 */
export function buildNavigationItems(isPerProtocol) {
  const items = [];

  // Section B questions (b1, b2, b3)
  const sectionBKeys = Object.keys(SECTION_B);
  sectionBKeys.forEach(key => {
    items.push({
      type: NAV_ITEM_TYPES.SECTION_B,
      key,
      label: key.toUpperCase(),
      section: 'Section B',
      questionDef: SECTION_B[key],
    });
  });

  // Active domains based on protocol type
  const activeDomains = getActiveDomainKeys(isPerProtocol);

  activeDomains.forEach(domainKey => {
    const domain = ROBINS_I_CHECKLIST[domainKey];
    const questions = getDomainQuestions(domainKey);
    const questionKeys = Object.keys(questions);

    // Add each question in the domain
    questionKeys.forEach(qKey => {
      const q = questions[qKey];
      items.push({
        type: NAV_ITEM_TYPES.DOMAIN_QUESTION,
        key: qKey,
        domainKey,
        label: q.number,
        section: domain.name,
        questionDef: q,
      });
    });

    // Add domain judgement item
    items.push({
      type: NAV_ITEM_TYPES.DOMAIN_JUDGEMENT,
      key: `${domainKey}_judgement`,
      domainKey,
      label: `D${domainKey.replace('domain', '').replace('a', 'A').replace('b', 'B')} Judge`,
      section: domain.name,
      isJudgement: true,
    });
  });

  // Overall judgement
  items.push({
    type: NAV_ITEM_TYPES.OVERALL_JUDGEMENT,
    key: 'overall_judgement',
    label: 'Overall',
    section: 'Overall',
    isJudgement: true,
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

  navItems.forEach(item => {
    if (!currentGroup || currentGroup.section !== item.section) {
      currentGroup = { section: item.section, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(item);
  });

  return groups;
}

/**
 * Check if a Section B question has been answered in the final answers
 * @param {string} key - The question key (b1, b2, b3)
 * @param {Object} finalAnswers - The reconciled checklist data
 * @returns {boolean}
 */
export function hasSectionBAnswer(key, finalAnswers) {
  return finalAnswers?.sectionB?.[key]?.answer != null;
}

/**
 * Check if a domain question has been answered in the final answers
 * @param {string} domainKey - The domain key (domain1a, domain2, etc.)
 * @param {string} questionKey - The question key (d1a_1, d2_1, etc.)
 * @param {Object} finalAnswers - The reconciled checklist data
 * @returns {boolean}
 */
export function hasDomainQuestionAnswer(domainKey, questionKey, finalAnswers) {
  return finalAnswers?.[domainKey]?.answers?.[questionKey]?.answer != null;
}

/**
 * Check if a domain judgement has been set
 * @param {string} domainKey - The domain key
 * @param {Object} finalAnswers - The reconciled checklist data
 * @returns {boolean}
 */
export function hasDomainJudgement(domainKey, finalAnswers) {
  return finalAnswers?.[domainKey]?.judgement != null;
}

/**
 * Check if overall judgement has been set
 * @param {Object} finalAnswers - The reconciled checklist data
 * @returns {boolean}
 */
export function hasOverallJudgement(finalAnswers) {
  return finalAnswers?.overall?.judgement != null;
}

/**
 * Check if a navigation item has been answered/completed
 * @param {Object} navItem - The navigation item
 * @param {Object} finalAnswers - The reconciled checklist data
 * @returns {boolean}
 */
export function hasNavItemAnswer(navItem, finalAnswers) {
  switch (navItem.type) {
    case NAV_ITEM_TYPES.SECTION_B:
      return hasSectionBAnswer(navItem.key, finalAnswers);
    case NAV_ITEM_TYPES.DOMAIN_QUESTION:
      return hasDomainQuestionAnswer(navItem.domainKey, navItem.key, finalAnswers);
    case NAV_ITEM_TYPES.DOMAIN_JUDGEMENT:
      return hasDomainJudgement(navItem.domainKey, finalAnswers);
    case NAV_ITEM_TYPES.OVERALL_JUDGEMENT:
      return hasOverallJudgement(finalAnswers);
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
    case NAV_ITEM_TYPES.SECTION_B: {
      const found = comparison.sectionB?.agreements?.find(a => a.key === navItem.key);
      return !!found;
    }
    case NAV_ITEM_TYPES.DOMAIN_QUESTION: {
      const domain = comparison.domains?.[navItem.domainKey];
      if (!domain) return false;
      const found = domain.questions?.agreements?.find(a => a.key === navItem.key);
      return !!found;
    }
    case NAV_ITEM_TYPES.DOMAIN_JUDGEMENT: {
      const domain = comparison.domains?.[navItem.domainKey];
      return domain?.judgementMatch && domain?.directionMatch;
    }
    case NAV_ITEM_TYPES.OVERALL_JUDGEMENT: {
      return comparison.overall?.judgementMatch && comparison.overall?.directionMatch;
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
    return 'bg-blue-600 text-white ring-2 ring-blue-300';
  }
  // Use lighter colors - checkmark icon indicates if answered
  return isAgreement
    ? 'bg-green-100 text-green-700 hover:bg-green-200'
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
 * Check if Section B indicates critical risk (B2 or B3 = Y/PY)
 * @param {Object} sectionB - Section B data from checklist
 * @returns {boolean}
 */
export function isSectionBCritical(sectionB) {
  const b2Answer = sectionB?.b2?.answer;
  const b3Answer = sectionB?.b3?.answer;
  return ['Y', 'PY'].includes(b2Answer) || ['Y', 'PY'].includes(b3Answer);
}

/**
 * Get domain display number from domain key
 * @param {string} domainKey - The domain key (domain1a, domain2, etc.)
 * @returns {string} Display number (1A, 1B, 2, 3, etc.)
 */
export function getDomainDisplayNumber(domainKey) {
  return domainKey
    .replace('domain', '')
    .replace('a', 'A')
    .replace('b', 'B');
}
