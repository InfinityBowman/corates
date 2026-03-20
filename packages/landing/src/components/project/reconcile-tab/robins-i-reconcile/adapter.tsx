/**
 * ROBINS-I Reconciliation Adapter
 *
 * Implements ReconciliationAdapter for ROBINS-I checklists.
 * Handles Section B questions, domain questions, domain judgements,
 * overall judgement, and section B critical risk detection.
 */

import { AlertTriangleIcon } from 'lucide-react';
import type {
  ReconciliationAdapter,
  ReconciliationNavItem,
  EngineContext,
  NavbarContext,
  SummaryContext,
} from '../engine/types';
import {
  compareChecklists,
  getSectionBKeys,
  getDomainKeysForComparison,
} from '@/components/checklist/ROBINSIChecklist/checklist-compare.js';
import {
  buildNavigationItems,
  hasNavItemAnswer as robinsHasNavItemAnswer,
  isNavItemAgreement as robinsIsNavItemAgreement,
  isSectionBCritical,
  NAV_ITEM_TYPES,
} from './navbar-utils.js';
import { SectionBQuestionPage } from './pages/SectionBQuestionPage';
import { DomainQuestionPage } from './pages/DomainQuestionPage';
import { DomainJudgementPage } from './pages/DomainJudgementPage';
import { OverallJudgementPage } from './pages/OverallJudgementPage';
import { RobinsINavbar } from './RobinsINavbar';
import { RobinsISummaryView } from './RobinsISummaryView';

// ---------------------------------------------------------------------------
// Y.Text helper
// ---------------------------------------------------------------------------

function copyCommentToYText(
  getTextRef: any,
  sectionKey: string,
  fieldKey: string,
  questionKey: string,
  commentText: string | null | undefined,
) {
  if (!getTextRef) return;
  const yText = getTextRef(sectionKey, fieldKey, questionKey);
  if (!yText) return;
  const text = (commentText || '').slice(0, 2000);
  yText.doc.transact(() => {
    yText.delete(0, yText.length);
    yText.insert(0, text);
  });
}

// ---------------------------------------------------------------------------
// Update helpers
// ---------------------------------------------------------------------------

function updateSectionBAnswer(
  updateChecklistAnswer: (s: string, d: unknown) => void,
  key: string,
  answer: string,
) {
  updateChecklistAnswer('sectionB', { [key]: { answer } });
}

function updateDomainQuestionAnswer(
  updateChecklistAnswer: (s: string, d: unknown) => void,
  domainKey: string,
  questionKey: string,
  answer: string,
) {
  updateChecklistAnswer(domainKey, {
    answers: { [questionKey]: { answer } },
  });
}

function updateDomainJudgement(
  updateChecklistAnswer: (s: string, d: unknown) => void,
  domainKey: string,
  judgement: string | null | undefined,
  direction: string | null | undefined,
) {
  updateChecklistAnswer(domainKey, {
    judgement,
    direction: direction || null,
  });
}

function updateOverallJudgement(
  updateChecklistAnswer: (s: string, d: unknown) => void,
  judgement: string | null | undefined,
  direction: string | null | undefined,
) {
  updateChecklistAnswer('overall', {
    judgement,
    direction: direction || null,
  });
}

// ---------------------------------------------------------------------------
// Comparison helper
// ---------------------------------------------------------------------------

function getCurrentItemComparison(item: any, comparison: any): any {
  if (!item || !comparison) return null;

  if (item.type === NAV_ITEM_TYPES.SECTION_B) {
    const allItems = [
      ...(comparison.sectionB?.agreements || []),
      ...(comparison.sectionB?.disagreements || []),
    ];
    return allItems.find((c: any) => c.key === item.key);
  }
  if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
    const domain = comparison.domains?.[item.domainKey];
    if (!domain) return null;
    const allItems = [
      ...(domain.questions?.agreements || []),
      ...(domain.questions?.disagreements || []),
    ];
    return allItems.find((c: any) => c.key === item.key);
  }
  if (item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT) {
    return comparison.domains?.[item.domainKey];
  }
  if (item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
    return comparison.overall;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Adapter: data derivation
// ---------------------------------------------------------------------------

function buildNavItems(reconciledChecklist: unknown): ReconciliationNavItem[] {
  // ROBINS-I uses checklist1's sectionC to determine per-protocol, but
  // reconciledChecklist may inherit it. For now use false as default.
  // The engine passes reconciledChecklist; we check sectionC if available.
  const rc = reconciledChecklist as any;
  const isPerProtocol = rc?.sectionC?.isPerProtocol || false;
  return buildNavigationItems(isPerProtocol) as ReconciliationNavItem[];
}

function deriveFinalAnswers(reconciledChecklist: unknown): unknown {
  return reconciledChecklist || {};
}

function compare(checklist1: unknown, checklist2: unknown): unknown {
  if (!checklist1 || !checklist2) return null;
  return compareChecklists(checklist1 as any, checklist2 as any);
}

// ---------------------------------------------------------------------------
// Adapter: answer checking
// ---------------------------------------------------------------------------

function hasAnswer(item: ReconciliationNavItem, finalAnswers: unknown): boolean {
  return robinsHasNavItemAnswer(item as any, finalAnswers as any);
}

function isAgreement(item: ReconciliationNavItem, comparison: unknown): boolean {
  return robinsIsNavItemAgreement(item as any, comparison as any);
}

// ---------------------------------------------------------------------------
// Adapter: write operations
// ---------------------------------------------------------------------------

function autoFillFromReviewer1(
  item: ReconciliationNavItem,
  checklist1: unknown,
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
  getTextRef: ((...args: unknown[]) => unknown) | null,
): void {
  const c1 = checklist1 as any;

  if (item.type === NAV_ITEM_TYPES.SECTION_B) {
    const answer = c1?.sectionB?.[item.key];
    if (answer) {
      updateSectionBAnswer(updateChecklistAnswer, item.key, answer.answer);
      copyCommentToYText(getTextRef, 'sectionB', 'comment', item.key, answer.comment);
    }
  } else if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && item.domainKey) {
    const answer = c1?.[item.domainKey]?.answers?.[item.key];
    if (answer) {
      updateDomainQuestionAnswer(updateChecklistAnswer, item.domainKey, item.key, answer.answer);
      copyCommentToYText(getTextRef, item.domainKey, 'comment', item.key, answer.comment);
    }
  } else if (item.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT && item.domainKey) {
    const domain = c1?.[item.domainKey];
    if (domain?.judgement) {
      updateDomainJudgement(
        updateChecklistAnswer,
        item.domainKey,
        domain.judgement,
        domain.direction,
      );
    }
  } else if (item.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
    const overall = c1?.overall;
    if (overall?.judgement) {
      updateOverallJudgement(updateChecklistAnswer, overall.judgement, overall.direction);
    }
  }
}

function resetAllAnswers(updateChecklistAnswer: (sectionKey: string, data: unknown) => void): void {
  const sectionBKeys = getSectionBKeys();
  const emptySectionB: Record<string, any> = {};
  sectionBKeys.forEach((key: string) => {
    emptySectionB[key] = { answer: null, comment: '' };
  });
  updateChecklistAnswer('sectionB', emptySectionB);

  // Reset all possible domains (both per-protocol and ITT)
  const allDomains = getDomainKeysForComparison(true).concat(getDomainKeysForComparison(false));
  const uniqueDomains = [...new Set(allDomains)];
  for (const domainKey of uniqueDomains) {
    updateChecklistAnswer(domainKey, {
      answers: {},
      judgement: null,
      direction: null,
    });
  }

  updateChecklistAnswer('overall', {
    judgement: null,
    direction: null,
  });
}

// ---------------------------------------------------------------------------
// Adapter: renderPage
// ---------------------------------------------------------------------------

function renderPage(context: EngineContext) {
  const { currentItem, checklist1, checklist2, finalAnswers, comparison, getTextRef } = context;
  const c1 = checklist1 as any;
  const c2 = checklist2 as any;
  const fa = finalAnswers as any;
  const itemComparison = getCurrentItemComparison(currentItem, comparison);

  if (currentItem.type === NAV_ITEM_TYPES.SECTION_B) {
    return (
      <SectionBQuestionPage
        questionKey={currentItem.key}
        reviewer1Data={c1?.sectionB?.[currentItem.key]}
        reviewer2Data={c2?.sectionB?.[currentItem.key]}
        finalData={fa.sectionB?.[currentItem.key]}
        finalCommentYText={getTextRef?.('sectionB', 'comment', currentItem.key)}
        reviewer1Name={context.reviewer1Name || 'Reviewer 1'}
        reviewer2Name={context.reviewer2Name || 'Reviewer 2'}
        isAgreement={context.isAgreement}
        onFinalAnswerChange={answer =>
          updateSectionBAnswer(context.updateChecklistAnswer, currentItem.key, answer)
        }
        onUseReviewer1={() => {
          const data = c1?.sectionB?.[currentItem.key];
          if (data) {
            updateSectionBAnswer(context.updateChecklistAnswer, currentItem.key, data.answer);
            copyCommentToYText(getTextRef, 'sectionB', 'comment', currentItem.key, data.comment);
          }
        }}
        onUseReviewer2={() => {
          const data = c2?.sectionB?.[currentItem.key];
          if (data) {
            updateSectionBAnswer(context.updateChecklistAnswer, currentItem.key, data.answer);
            copyCommentToYText(getTextRef, 'sectionB', 'comment', currentItem.key, data.comment);
          }
        }}
      />
    );
  }

  if (currentItem.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && currentItem.domainKey) {
    return (
      <DomainQuestionPage
        domainKey={currentItem.domainKey}
        questionKey={currentItem.key}
        reviewer1Data={c1?.[currentItem.domainKey]?.answers?.[currentItem.key]}
        reviewer2Data={c2?.[currentItem.domainKey]?.answers?.[currentItem.key]}
        finalData={fa[currentItem.domainKey]?.answers?.[currentItem.key]}
        finalCommentYText={getTextRef?.(currentItem.domainKey, 'comment', currentItem.key)}
        reviewer1Name={context.reviewer1Name || 'Reviewer 1'}
        reviewer2Name={context.reviewer2Name || 'Reviewer 2'}
        isAgreement={context.isAgreement}
        onFinalAnswerChange={answer =>
          updateDomainQuestionAnswer(
            context.updateChecklistAnswer,
            currentItem.domainKey!,
            currentItem.key,
            answer,
          )
        }
        onUseReviewer1={() => {
          const data = c1?.[currentItem.domainKey!]?.answers?.[currentItem.key];
          if (data) {
            updateDomainQuestionAnswer(
              context.updateChecklistAnswer,
              currentItem.domainKey!,
              currentItem.key,
              data.answer,
            );
            copyCommentToYText(
              getTextRef,
              currentItem.domainKey!,
              'comment',
              currentItem.key,
              data.comment,
            );
          }
        }}
        onUseReviewer2={() => {
          const data = c2?.[currentItem.domainKey!]?.answers?.[currentItem.key];
          if (data) {
            updateDomainQuestionAnswer(
              context.updateChecklistAnswer,
              currentItem.domainKey!,
              currentItem.key,
              data.answer,
            );
            copyCommentToYText(
              getTextRef,
              currentItem.domainKey!,
              'comment',
              currentItem.key,
              data.comment,
            );
          }
        }}
      />
    );
  }

  if (currentItem.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT && currentItem.domainKey) {
    return (
      <DomainJudgementPage
        domainKey={currentItem.domainKey}
        reviewer1Data={c1?.[currentItem.domainKey]}
        reviewer2Data={c2?.[currentItem.domainKey]}
        finalData={fa[currentItem.domainKey]}
        reviewer1Name={context.reviewer1Name || 'Reviewer 1'}
        reviewer2Name={context.reviewer2Name || 'Reviewer 2'}
        judgementMatch={itemComparison?.judgementMatch}
        directionMatch={itemComparison?.directionMatch}
        onFinalJudgementChange={judgement =>
          updateDomainJudgement(
            context.updateChecklistAnswer,
            currentItem.domainKey!,
            judgement,
            fa[currentItem.domainKey!]?.direction,
          )
        }
        onFinalDirectionChange={direction =>
          updateDomainJudgement(
            context.updateChecklistAnswer,
            currentItem.domainKey!,
            fa[currentItem.domainKey!]?.judgement,
            direction,
          )
        }
        onUseReviewer1Judgement={() => {
          const data = c1?.[currentItem.domainKey!];
          if (data)
            updateDomainJudgement(
              context.updateChecklistAnswer,
              currentItem.domainKey!,
              data.judgement,
              fa[currentItem.domainKey!]?.direction,
            );
        }}
        onUseReviewer2Judgement={() => {
          const data = c2?.[currentItem.domainKey!];
          if (data)
            updateDomainJudgement(
              context.updateChecklistAnswer,
              currentItem.domainKey!,
              data.judgement,
              fa[currentItem.domainKey!]?.direction,
            );
        }}
        onUseReviewer1Direction={() => {
          const data = c1?.[currentItem.domainKey!];
          if (data)
            updateDomainJudgement(
              context.updateChecklistAnswer,
              currentItem.domainKey!,
              fa[currentItem.domainKey!]?.judgement,
              data.direction,
            );
        }}
        onUseReviewer2Direction={() => {
          const data = c2?.[currentItem.domainKey!];
          if (data)
            updateDomainJudgement(
              context.updateChecklistAnswer,
              currentItem.domainKey!,
              fa[currentItem.domainKey!]?.judgement,
              data.direction,
            );
        }}
      />
    );
  }

  if (currentItem.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
    return (
      <OverallJudgementPage
        reviewer1Data={c1?.overall}
        reviewer2Data={c2?.overall}
        finalData={fa.overall}
        reviewer1Name={context.reviewer1Name || 'Reviewer 1'}
        reviewer2Name={context.reviewer2Name || 'Reviewer 2'}
        judgementMatch={itemComparison?.judgementMatch}
        directionMatch={itemComparison?.directionMatch}
        onFinalJudgementChange={judgement =>
          updateOverallJudgement(context.updateChecklistAnswer, judgement, fa.overall?.direction)
        }
        onFinalDirectionChange={direction =>
          updateOverallJudgement(context.updateChecklistAnswer, fa.overall?.judgement, direction)
        }
        onUseReviewer1Judgement={() => {
          const data = c1?.overall;
          if (data)
            updateOverallJudgement(
              context.updateChecklistAnswer,
              data.judgement,
              fa.overall?.direction,
            );
        }}
        onUseReviewer2Judgement={() => {
          const data = c2?.overall;
          if (data)
            updateOverallJudgement(
              context.updateChecklistAnswer,
              data.judgement,
              fa.overall?.direction,
            );
        }}
        onUseReviewer1Direction={() => {
          const data = c1?.overall;
          if (data)
            updateOverallJudgement(
              context.updateChecklistAnswer,
              fa.overall?.judgement,
              data.direction,
            );
        }}
        onUseReviewer2Direction={() => {
          const data = c2?.overall;
          if (data)
            updateOverallJudgement(
              context.updateChecklistAnswer,
              fa.overall?.judgement,
              data.direction,
            );
        }}
      />
    );
  }

  return <div className='py-12 text-center'>Unknown item type</div>;
}

// ---------------------------------------------------------------------------
// Adapter: NavbarComponent wrapper
// ---------------------------------------------------------------------------

function RobinsINavbarAdapter(navbarContext: NavbarContext) {
  // Recompute sectionBCritical from finalAnswers
  const fa = navbarContext.finalAnswers as any;
  const sectionBCrit = isSectionBCritical(fa?.sectionB);

  const store = {
    navItems: navbarContext.navItems,
    viewMode: navbarContext.viewMode,
    currentPage: navbarContext.currentPage,
    comparison: navbarContext.comparison,
    finalAnswers: navbarContext.finalAnswers,
    sectionBCritical: sectionBCrit,
    expandedDomain: navbarContext.expandedDomain,
    setViewMode: navbarContext.setViewMode as (mode: string) => void,
    goToPage: navbarContext.goToPage,
    setExpandedDomain: navbarContext.setExpandedDomain,
    onReset: navbarContext.onReset,
  };

  return <RobinsINavbar store={store} />;
}

// ---------------------------------------------------------------------------
// Adapter: SummaryComponent wrapper
// ---------------------------------------------------------------------------

function RobinsISummaryAdapter(summaryContext: SummaryContext) {
  return (
    <RobinsISummaryView
      navItems={summaryContext.navItems}
      finalAnswers={summaryContext.finalAnswers}
      comparison={summaryContext.comparison}
      summary={summaryContext.summaryStats}
      onGoToPage={summaryContext.onGoToPage}
      onSave={summaryContext.onSave}
      onBack={summaryContext.onBack}
      allAnswered={summaryContext.allAnswered}
      saving={summaryContext.saving}
    />
  );
}

// ---------------------------------------------------------------------------
// Adapter: Warning banner
// ---------------------------------------------------------------------------

function renderWarningBanner(checklist1: unknown, checklist2: unknown) {
  const c1 = checklist1 as any;
  const c2 = checklist2 as any;
  const critical1 = isSectionBCritical(c1?.sectionB);
  const critical2 = isSectionBCritical(c2?.sectionB);

  if (!critical1 && !critical2) return null;

  return (
    <div className='border-destructive/20 bg-destructive/10 text-destructive mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm'>
      <AlertTriangleIcon className='size-5 shrink-0' />
      <div>
        <span className='font-medium'>Critical Risk Detected:</span> Section B indicates this study
        may be at critical risk of bias. Consider whether to proceed with full domain assessment.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export adapter
// ---------------------------------------------------------------------------

export const robinsIAdapter: ReconciliationAdapter = {
  checklistType: 'ROBINS_I',
  title: 'ROBINS-I Reconciliation',
  pageCounterLabel: 'Item',
  getPageLabel: (pageIndex: number) => `Item ${pageIndex + 1}`,

  buildNavItems,
  deriveFinalAnswers,
  compare,

  hasAnswer,
  isAgreement,

  autoFillFromReviewer1,
  resetAllAnswers,

  renderPage,
  NavbarComponent: RobinsINavbarAdapter,
  SummaryComponent: RobinsISummaryAdapter,
  renderWarningBanner,
};
