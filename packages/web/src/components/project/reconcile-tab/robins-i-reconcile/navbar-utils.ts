/**
 * Utility functions for Robins-I Reconciliation Navbar
 * Handles navigation item building, state calculations and styling
 */
import {
  SECTION_B,
  getDomainQuestions,
  getActiveDomainKeys,
  ROBINS_I_CHECKLIST,
} from '@/components/checklist/ROBINSIChecklist/checklist-map';

type ROBINSQuestion = ReturnType<typeof getDomainQuestions>[string];

/**
 * Navigation item types
 */
export const NAV_ITEM_TYPES = {
  SECTION_B: 'sectionB',
  DOMAIN_QUESTION: 'domainQuestion',
  DOMAIN_JUDGEMENT: 'domainJudgement',
  OVERALL_JUDGEMENT: 'overallJudgement',
} as const;

interface NavItem {
  type: string;
  key: string;
  label: string;
  section: string;
  sectionKey?: string;
  domainKey?: string;
  questionDef?: ROBINSQuestion | Record<string, unknown>;
  isJudgement?: boolean;
  [key: string]: unknown;
}

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

interface ComparisonDomain {
  questions?: {
    agreements?: Array<{ key: string }>;
    disagreements?: Array<{ key: string }>;
  };
  judgementMatch?: boolean;
  directionMatch?: boolean;
  reviewer1?: { judgement?: string; direction?: string };
  reviewer2?: { judgement?: string; direction?: string };
}

interface Comparison {
  sectionB?: {
    agreements?: Array<{ key: string }>;
    disagreements?: Array<{ key: string }>;
  };
  domains?: Record<string, ComparisonDomain>;
  overall?: {
    judgementMatch?: boolean;
    directionMatch?: boolean;
  };
}

type FinalAnswers = Record<string, unknown>;

/**
 * Build the full navigation items array based on protocol type
 */
export function buildNavigationItems(isPerProtocol: boolean): NavItem[] {
  const items: NavItem[] = [];

  // Section B questions (b1, b2, b3)
  const sectionBKeys = Object.keys(SECTION_B);
  sectionBKeys.forEach(key => {
    items.push({
      type: NAV_ITEM_TYPES.SECTION_B,
      key,
      label: key.toUpperCase(),
      section: 'Section B',
      sectionKey: 'sectionB',
      questionDef: SECTION_B[key as keyof typeof SECTION_B] as unknown as Record<string, unknown>,
    });
  });

  // Active domains based on protocol type
  const activeDomains = getActiveDomainKeys(isPerProtocol);

  activeDomains.forEach(domainKey => {
    const domain = ROBINS_I_CHECKLIST[domainKey as keyof typeof ROBINS_I_CHECKLIST] as
      | { name: string; [key: string]: unknown }
      | undefined;
    const questions = getDomainQuestions(domainKey);
    const questionKeys = Object.keys(questions);

    // Add each question in the domain
    questionKeys.forEach(qKey => {
      const q = questions[qKey];
      items.push({
        type: NAV_ITEM_TYPES.DOMAIN_QUESTION,
        key: qKey,
        domainKey,
        label: q.number!,
        section: domain!.name,
        sectionKey: domainKey,
        questionDef: q,
      });
    });

    // Add domain judgement item
    items.push({
      type: NAV_ITEM_TYPES.DOMAIN_JUDGEMENT,
      key: `${domainKey}_judgement`,
      domainKey,
      label: `D${domainKey.replace('domain', '').replace('a', 'A').replace('b', 'B')} Judge`,
      section: domain!.name,
      sectionKey: domainKey,
      isJudgement: true,
    });
  });

  // Overall judgement
  items.push({
    type: NAV_ITEM_TYPES.OVERALL_JUDGEMENT,
    key: 'overall_judgement',
    label: 'Overall',
    section: 'Overall',
    sectionKey: 'overall',
    isJudgement: true,
  });

  return items;
}

/**
 * Get grouped navigation items for display (grouped by section)
 */
export function getGroupedNavigationItems(navItems: NavItem[]): NavGroup[] {
  const groups: NavGroup[] = [];
  let currentGroup: NavGroup | null = null;

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
 */
function hasSectionBAnswer(key: string, finalAnswers: FinalAnswers): boolean {
  const sectionB = finalAnswers?.sectionB as Record<string, Record<string, unknown>> | undefined;
  return sectionB?.[key]?.answer != null;
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
 * Check if a domain judgement has been set
 */
function hasDomainJudgement(domainKey: string, finalAnswers: FinalAnswers): boolean {
  const domain = finalAnswers?.[domainKey] as Record<string, unknown> | undefined;
  return domain?.judgement != null;
}

/**
 * Check if overall judgement has been set
 */
function hasOverallJudgement(finalAnswers: FinalAnswers): boolean {
  const overall = finalAnswers?.overall as Record<string, unknown> | undefined;
  return overall?.judgement != null;
}

/**
 * Check if a navigation item has been answered/completed
 */
export function hasNavItemAnswer(navItem: NavItem, finalAnswers: FinalAnswers): boolean {
  switch (navItem.type) {
    case NAV_ITEM_TYPES.SECTION_B:
      return hasSectionBAnswer(navItem.key, finalAnswers);
    case NAV_ITEM_TYPES.DOMAIN_QUESTION:
      return hasDomainQuestionAnswer(navItem.domainKey!, navItem.key, finalAnswers);
    case NAV_ITEM_TYPES.DOMAIN_JUDGEMENT:
      return hasDomainJudgement(navItem.domainKey!, finalAnswers);
    case NAV_ITEM_TYPES.OVERALL_JUDGEMENT:
      return hasOverallJudgement(finalAnswers);
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
    case NAV_ITEM_TYPES.SECTION_B: {
      const found = comparison.sectionB?.agreements?.find(a => a.key === navItem.key);
      return !!found;
    }
    case NAV_ITEM_TYPES.DOMAIN_QUESTION: {
      const domain = comparison.domains?.[navItem.domainKey!];
      if (!domain) return false;
      const found = domain.questions?.agreements?.find(a => a.key === navItem.key);
      return !!found;
    }
    case NAV_ITEM_TYPES.DOMAIN_JUDGEMENT: {
      const domain = comparison.domains?.[navItem.domainKey!];
      return !!(domain?.judgementMatch && domain?.directionMatch);
    }
    case NAV_ITEM_TYPES.OVERALL_JUDGEMENT: {
      return !!(comparison.overall?.judgementMatch && comparison.overall?.directionMatch);
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
 * Check if Section B indicates critical risk (B2 or B3 = Y/PY)
 */
export function isSectionBCritical(
  sectionB: Record<string, { answer?: string }> | undefined,
): boolean {
  const b2Answer = sectionB?.b2?.answer;
  const b3Answer = sectionB?.b3?.answer;
  return ['Y', 'PY'].includes(b2Answer!) || ['Y', 'PY'].includes(b3Answer!);
}

/**
 * Get abbreviated label for a section/domain pill
 */
export function getSectionLabel(sectionKey: string): string {
  if (sectionKey === 'sectionB') return 'B';
  if (sectionKey === 'overall') return 'OA';
  if (sectionKey.startsWith('domain')) {
    const num = sectionKey.replace('domain', '').replace('a', '').replace('b', '');
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

  groups.forEach(group => {
    const firstItem = group.items[0];
    const sectionKey = firstItem.sectionKey ?? firstItem.key;

    let answered = 0;
    let hasDisagreements = false;

    group.items.forEach(item => {
      if (hasNavItemAnswer(item, finalAnswers)) {
        answered++;
      }
      if (!isNavItemAgreement(item, comparison)) {
        hasDisagreements = true;
      }
    });

    progress[sectionKey] = {
      answered,
      total: group.items.length,
      hasDisagreements,
      isComplete: answered === group.items.length,
      section: group.section,
      items: group.items,
    };
  });

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
  return navItems.indexOf(sectionProgress.items[0]);
}
