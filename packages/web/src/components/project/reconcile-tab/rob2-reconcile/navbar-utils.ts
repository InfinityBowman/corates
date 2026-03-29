/**
 * Utility functions for ROB-2 Reconciliation Navbar
 * Handles navigation item building, state calculations and styling
 */
import {
  ROB2_CHECKLIST,
  PRELIMINARY_SECTION,
  getActiveDomainKeys,
} from '@corates/shared/checklists/rob2';
import type { ROB2Domain } from '@corates/shared/checklists/rob2';

/**
 * Navigation item types
 */
export const NAV_ITEM_TYPES = {
  PRELIMINARY: 'preliminary',
  DOMAIN_QUESTION: 'domainQuestion',
  DOMAIN_DIRECTION: 'domainDirection',
  OVERALL_DIRECTION: 'overallDirection',
} as const;

export type NavItemType = (typeof NAV_ITEM_TYPES)[keyof typeof NAV_ITEM_TYPES];

export interface NavItem {
  type: NavItemType;
  key: string;
  label: string;
  section: string;
  sectionKey: string;
  domainKey?: string;
  fieldDef?: (typeof PRELIMINARY_SECTION)[keyof typeof PRELIMINARY_SECTION];
  questionDef?: Record<string, unknown>;
  isDirection?: boolean;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

export interface SectionProgress {
  answered: number;
  total: number;
  hasDisagreements: boolean;
  isComplete: boolean;
  section: string;
  items: NavItem[];
}

interface ComparisonField {
  key: string;
  isAgreement: boolean;
}

interface ComparisonDomain {
  questions?: {
    agreements?: Array<{ key: string }>;
    disagreements?: Array<{ key: string }>;
  };
  directionMatch?: boolean;
  reviewer1?: { judgement?: string; direction?: string };
  reviewer2?: { judgement?: string; direction?: string };
}

interface Comparison {
  preliminary?: {
    fields?: ComparisonField[];
  };
  domains?: Record<string, ComparisonDomain>;
  overall?: {
    directionMatch?: boolean;
  };
}

type FinalAnswers = Record<string, unknown>;

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
] as const;

/**
 * Build the full navigation items array based on aim selection
 */
export function buildNavigationItems(isAdhering: boolean): NavItem[] {
  const items: NavItem[] = [];

  // Preliminary section fields - deviationsToAddress only applies to ADHERING aim
  for (const key of PRELIMINARY_FIELD_KEYS) {
    if (key === 'deviationsToAddress' && !isAdhering) continue;

    const fieldDef = PRELIMINARY_SECTION[key as keyof typeof PRELIMINARY_SECTION];
    items.push({
      type: NAV_ITEM_TYPES.PRELIMINARY,
      key,
      label: fieldDef?.label || key,
      section: 'Preliminary',
      sectionKey: 'preliminary',
      fieldDef,
    });
  }

  // Active domains based on aim type
  const activeDomains = getActiveDomainKeys(isAdhering);

  for (const domainKey of activeDomains) {
    const domain = ROB2_CHECKLIST[domainKey] as ROB2Domain | undefined;
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
        sectionKey: domainKey,
        questionDef: q as unknown as Record<string, unknown>,
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
        sectionKey: domainKey,
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
    sectionKey: 'overall',
    isDirection: true,
  });

  return items;
}

/**
 * Get grouped navigation items for display (grouped by section)
 */
export function getGroupedNavigationItems(navItems: NavItem[]): NavGroup[] {
  const groups: NavGroup[] = [];
  let currentGroup: NavGroup | null = null;

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
 */
export function hasPreliminaryAnswer(key: string, finalAnswers: FinalAnswers): boolean {
  const preliminary = finalAnswers?.preliminary as Record<string, unknown> | undefined;
  const value = preliminary?.[key];
  if (key === 'deviationsToAddress') {
    return Array.isArray(value) && value.length > 0;
  }
  if (key === 'sources') {
    return (
      typeof value === 'object' &&
      Object.values((value as Record<string, unknown>) || {}).some(v => v)
    );
  }
  return value != null && value !== '';
}

/**
 * Check if a domain question has been answered in the final answers
 */
export function hasDomainQuestionAnswer(
  domainKey: string,
  questionKey: string,
  finalAnswers: FinalAnswers,
): boolean {
  const domain = finalAnswers?.[domainKey] as Record<string, unknown> | undefined;
  const answers = domain?.answers as Record<string, Record<string, unknown>> | undefined;
  return answers?.[questionKey]?.answer != null;
}

/**
 * Check if a domain direction has been set
 */
export function hasDomainDirection(domainKey: string, finalAnswers: FinalAnswers): boolean {
  const domain = finalAnswers?.[domainKey] as Record<string, unknown> | undefined;
  return domain?.direction != null;
}

/**
 * Check if overall direction has been set
 */
export function hasOverallDirection(finalAnswers: FinalAnswers): boolean {
  const overall = finalAnswers?.overall as Record<string, unknown> | undefined;
  return overall?.direction != null;
}

/**
 * Check if a navigation item has been answered/completed
 */
export function hasNavItemAnswer(navItem: NavItem, finalAnswers: FinalAnswers): boolean {
  switch (navItem.type) {
    case NAV_ITEM_TYPES.PRELIMINARY:
      return hasPreliminaryAnswer(navItem.key, finalAnswers);
    case NAV_ITEM_TYPES.DOMAIN_QUESTION:
      return hasDomainQuestionAnswer(navItem.domainKey!, navItem.key, finalAnswers);
    case NAV_ITEM_TYPES.DOMAIN_DIRECTION:
      return hasDomainDirection(navItem.domainKey!, finalAnswers);
    case NAV_ITEM_TYPES.OVERALL_DIRECTION:
      return hasOverallDirection(finalAnswers);
    default:
      return false;
  }
}

/**
 * Check if reviewers agreed on a navigation item
 */
export function isNavItemAgreement(navItem: NavItem, comparison: Comparison | null): boolean {
  if (!comparison) return false;

  switch (navItem.type) {
    case NAV_ITEM_TYPES.PRELIMINARY: {
      const field = comparison.preliminary?.fields?.find(f => f.key === navItem.key);
      return field?.isAgreement ?? false;
    }
    case NAV_ITEM_TYPES.DOMAIN_QUESTION: {
      const domain = comparison.domains?.[navItem.domainKey!];
      if (!domain) return false;
      const found = domain.questions?.agreements?.find(a => a.key === navItem.key);
      return !!found;
    }
    case NAV_ITEM_TYPES.DOMAIN_DIRECTION: {
      const domain = comparison.domains?.[navItem.domainKey!];
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
 */
export function getNavItemPillStyle(
  isCurrentPage: boolean,
  _hasAnswer: boolean,
  isAgreement: boolean,
): string {
  if (isCurrentPage) {
    return 'bg-blue-600 text-white ring-2 ring-inset ring-blue-300';
  }
  return isAgreement ?
      'bg-green-100 text-green-700 hover:bg-green-200'
    : 'bg-amber-100 text-amber-700 hover:bg-amber-200';
}

/**
 * Generate descriptive tooltip for a navigation pill
 */
export function getNavItemTooltip(
  navItem: NavItem,
  hasAnswer: boolean,
  isAgreement: boolean,
): string {
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
 */
export function getAnsweredCount(navItems: NavItem[], finalAnswers: FinalAnswers): number {
  return navItems.filter(item => hasNavItemAnswer(item, finalAnswers)).length;
}

/**
 * Get domain display number from domain key
 */
export function getDomainDisplayNumber(domainKey: string): string {
  return domainKey.replace('domain', '').replace('a', 'A').replace('b', 'B');
}

/**
 * Get section key from section name (for grouping)
 */
export function getSectionKey(sectionName: string): string {
  if (sectionName === 'Preliminary') return 'preliminary';
  if (sectionName === 'Overall') return 'overall';

  // Domain names like "Domain 1: Bias arising from the randomization process"
  const domainMatch = sectionName.match(/Domain (\d+)/);
  if (domainMatch) {
    const domainNum = domainMatch[1];
    if (domainNum === '2') {
      return 'domain2';
    }
    return `domain${domainNum}`;
  }

  return sectionName;
}

/**
 * Get abbreviated label for a section/domain pill
 */
export function getSectionLabel(sectionKey: string): string {
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
 */
export function getDomainProgress(
  navItems: NavItem[],
  finalAnswers: FinalAnswers,
  comparison: Comparison | null,
): Record<string, SectionProgress> {
  const progress: Record<string, SectionProgress> = {};
  const groups = getGroupedNavigationItems(navItems);

  for (const group of groups) {
    const firstItem = group.items[0];
    const sectionKey = firstItem.sectionKey;

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
 */
export function getSectionKeyForPage(navItems: NavItem[], pageIndex: number): string | null {
  return navItems[pageIndex]?.sectionKey ?? null;
}

/**
 * Find the first unanswered item index within a section
 */
export function getFirstUnansweredInSection(
  sectionProgress: SectionProgress,
  navItems: NavItem[],
  finalAnswers: FinalAnswers,
): number {
  for (const item of sectionProgress.items) {
    if (!hasNavItemAnswer(item, finalAnswers)) {
      return navItems.indexOf(item);
    }
  }
  // All answered - return first item in section
  return navItems.indexOf(sectionProgress.items[0]);
}
