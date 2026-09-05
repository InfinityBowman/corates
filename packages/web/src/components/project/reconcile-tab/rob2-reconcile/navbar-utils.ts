/**
 * Utility functions for ROB-2 Reconciliation Navbar
 * Handles navigation item building, state calculations and styling
 */
import {
  ROB2_CHECKLIST,
  PRELIMINARY_SECTION,
  getActiveDomainKeys,
  getDomainQuestions,
  getReachableQuestions,
  getSkippedQuestions,
} from '@corates/shared/checklists/rob2';
import type { DomainAnswers, ROB2Domain } from '@corates/shared/checklists/rob2';

/**
 * Navigation item types
 */
export const NAV_ITEM_TYPES = {
  PRELIMINARY: 'preliminary',
  DOMAIN_QUESTION: 'domainQuestion',
  DOMAIN_DIRECTION: 'domainDirection',
  OVERALL_DIRECTION: 'overallDirection',
} as const;

interface NavItemBase {
  key: string;
  label: string;
  section: string;
  sectionKey: string;
}

export type Rob2NavItem =
  | (NavItemBase & {
      type: typeof NAV_ITEM_TYPES.PRELIMINARY;
      fieldDef?: (typeof PRELIMINARY_SECTION)[keyof typeof PRELIMINARY_SECTION];
    })
  | (NavItemBase & {
      type: typeof NAV_ITEM_TYPES.DOMAIN_QUESTION;
      domainKey: string;
      questionDef?: Record<string, unknown>;
    })
  | (NavItemBase & {
      type: typeof NAV_ITEM_TYPES.DOMAIN_DIRECTION;
      domainKey: string;
      isDirection: true;
    })
  | (NavItemBase & {
      type: typeof NAV_ITEM_TYPES.OVERALL_DIRECTION;
      isDirection: true;
    });

type NavItem = Rob2NavItem;

interface NavGroup {
  section: string;
  items: NavItem[];
}

interface SectionProgress {
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

interface ComparisonQuestion {
  key: string;
  reviewer1?: { answer: string | null };
  reviewer2?: { answer: string | null };
}

interface ComparisonDomain {
  questions?: {
    agreements?: ComparisonQuestion[];
    disagreements?: ComparisonQuestion[];
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

const skippedQuestionsCache = new WeakMap<object, Set<string>>();

/** Per-checklist skips for the reviewer panels, cached because answer checks run inside render loops. */
export function getSkippedQuestionsCached(checklist: FinalAnswers | null | undefined): Set<string> {
  if (!checklist || typeof checklist !== 'object') return new Set();
  let cached = skippedQuestionsCache.get(checklist);
  if (!cached) {
    cached = getSkippedQuestions(checklist as Parameters<typeof getSkippedQuestions>[0]);
    skippedQuestionsCache.set(checklist, cached);
  }
  return cached;
}

/**
 * Consensus skips, with the reviewers' agreed answers standing in for consensus
 * answers not yet recorded so the skip shows before the walk reaches the
 * question. A consensus answer always wins; a disagreement assumes nothing.
 */
export function getConsensusSkippedQuestions(
  finalAnswers: FinalAnswers,
  comparison: Comparison | null,
): Set<string> {
  const skipped = new Set<string>();
  const preliminary = finalAnswers?.preliminary as Record<string, unknown> | undefined;
  const isAdhering = preliminary?.aim === 'ADHERING';

  for (const domainKey of getActiveDomainKeys(isAdhering)) {
    const finalDomain = finalAnswers?.[domainKey] as Record<string, unknown> | undefined;
    const finalDomainAnswers = finalDomain?.answers as
      Record<string, { answer?: string | null }> | undefined;

    const agreed = new Map<string, string>();
    for (const q of comparison?.domains?.[domainKey]?.questions?.agreements ?? []) {
      const a1 = q.reviewer1?.answer ?? null;
      if (a1 != null && a1 === (q.reviewer2?.answer ?? null)) agreed.set(q.key, a1);
    }

    const questionKeys = Object.keys(getDomainQuestions(domainKey));
    const effective: DomainAnswers = {};
    for (const qKey of questionKeys) {
      effective[qKey] = { answer: finalDomainAnswers?.[qKey]?.answer ?? agreed.get(qKey) ?? null };
    }

    const reachable = getReachableQuestions(domainKey, effective);
    for (const qKey of questionKeys) {
      if (!reachable.has(qKey) && finalDomainAnswers?.[qKey]?.answer == null) {
        skipped.add(qKey);
      }
    }
  }
  return skipped;
}

const consensusSkipCache = new WeakMap<
  object,
  { comparison: Comparison | null; skipped: Set<string> }
>();

/** Cached per (finalAnswers, comparison) pair: answer checks run inside render loops. */
export function getConsensusSkippedQuestionsCached(
  finalAnswers: FinalAnswers | null | undefined,
  comparison: Comparison | null | undefined,
): Set<string> {
  if (!finalAnswers || typeof finalAnswers !== 'object') return new Set();
  const comp = comparison ?? null;
  const cached = consensusSkipCache.get(finalAnswers);
  if (cached && cached.comparison === comp) return cached.skipped;
  const skipped = getConsensusSkippedQuestions(finalAnswers, comp);
  consensusSkipCache.set(finalAnswers, { comparison: comp, skipped });
  return skipped;
}

/**
 * Check if a preliminary field has been answered in the final answers
 */
function hasPreliminaryAnswer(key: string, finalAnswers: FinalAnswers): boolean {
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
function hasDomainQuestionAnswer(
  domainKey: string,
  questionKey: string,
  finalAnswers: FinalAnswers,
): boolean {
  const domain = finalAnswers?.[domainKey] as Record<string, unknown> | undefined;
  const answers = domain?.answers as Record<string, Record<string, unknown>> | undefined;
  return answers?.[questionKey]?.answer != null;
}

/**
 * Whether a nav item is satisfied. Direction is optional and never blocks
 * completion. Off-path domain questions are satisfied without a stored answer,
 * since most of their scales have no NA option.
 */
export function hasNavItemAnswer(
  navItem: NavItem,
  finalAnswers: FinalAnswers,
  comparison: Comparison | null,
): boolean {
  switch (navItem.type) {
    case NAV_ITEM_TYPES.PRELIMINARY:
      return hasPreliminaryAnswer(navItem.key, finalAnswers);
    case NAV_ITEM_TYPES.DOMAIN_QUESTION:
      return (
        hasDomainQuestionAnswer(navItem.domainKey, navItem.key, finalAnswers) ||
        getConsensusSkippedQuestionsCached(finalAnswers, comparison).has(navItem.key)
      );
    case NAV_ITEM_TYPES.DOMAIN_DIRECTION:
    case NAV_ITEM_TYPES.OVERALL_DIRECTION:
      return true;
  }
}

/**
 * Whether a nav item holds a real value. Unlike hasNavItemAnswer, an unset
 * direction is not satisfied here, so the check indicators do not show it as
 * filled.
 */
export function hasNavItemValue(
  navItem: NavItem,
  finalAnswers: FinalAnswers,
  comparison: Comparison | null,
): boolean {
  switch (navItem.type) {
    case NAV_ITEM_TYPES.PRELIMINARY:
      return hasPreliminaryAnswer(navItem.key, finalAnswers);
    case NAV_ITEM_TYPES.DOMAIN_QUESTION:
      return (
        hasDomainQuestionAnswer(navItem.domainKey, navItem.key, finalAnswers) ||
        getConsensusSkippedQuestionsCached(finalAnswers, comparison).has(navItem.key)
      );
    case NAV_ITEM_TYPES.DOMAIN_DIRECTION: {
      const domain = finalAnswers?.[navItem.domainKey] as Record<string, unknown> | undefined;
      return domain?.direction != null && domain.direction !== '';
    }
    case NAV_ITEM_TYPES.OVERALL_DIRECTION: {
      const overall = finalAnswers?.overall as Record<string, unknown> | undefined;
      return overall?.direction != null && overall.direction !== '';
    }
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
      if (hasNavItemAnswer(item, finalAnswers, comparison)) {
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
  comparison: Comparison | null,
): number {
  for (const item of sectionProgress.items) {
    if (!hasNavItemAnswer(item, finalAnswers, comparison)) {
      return navItems.indexOf(item);
    }
  }
  return navItems.indexOf(sectionProgress.items[0]);
}
