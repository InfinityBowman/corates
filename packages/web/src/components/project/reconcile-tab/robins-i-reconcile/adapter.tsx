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
  EngineContext,
  NavbarContext,
  SummaryContext,
} from '../engine/types';
import type { TextRef } from '@/primitives/useProject/checklists';
import { assertNever } from '@corates/shared';
import type {
  ROBINSIChecklist,
  ROBINSIDomainState,
  ROBINSIQuestionAnswer,
} from '@corates/shared/checklists';
import {
  compareChecklists,
  getSectionBKeys,
  getDomainKeysForComparison,
  type ComparisonResult,
} from '@/components/checklist/ROBINSIChecklist/checklist-compare.js';
import {
  buildNavigationItems,
  hasNavItemAnswer as robinsHasNavItemAnswer,
  isNavItemAgreement as robinsIsNavItemAgreement,
  isSectionBCritical,
  NAV_ITEM_TYPES,
  type RobinsINavItem,
} from './navbar-utils.js';
import { SectionBQuestionPage } from './pages/SectionBQuestionPage';
import { DomainQuestionPage } from './pages/DomainQuestionPage';
import { DomainJudgementPage } from './pages/DomainJudgementPage';
import { OverallJudgementPage } from './pages/OverallJudgementPage';
import { RobinsINavbar } from './RobinsINavbar';
import { RobinsISummaryView } from './RobinsISummaryView';

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
// Adapter: data derivation
// ---------------------------------------------------------------------------

function buildNavItems(reconciledChecklist: ROBINSIChecklist | null): RobinsINavItem[] {
  const isPerProtocol = reconciledChecklist?.sectionC?.isPerProtocol || false;
  return buildNavigationItems(isPerProtocol);
}

function deriveFinalAnswers(reconciledChecklist: ROBINSIChecklist | null): ROBINSIChecklist {
  return (reconciledChecklist || {}) as ROBINSIChecklist;
}

function compare(
  checklist1: ROBINSIChecklist | null,
  checklist2: ROBINSIChecklist | null,
): ComparisonResult | null {
  if (!checklist1 || !checklist2) return null;
  return compareChecklists(checklist1, checklist2);
}

// ---------------------------------------------------------------------------
// Adapter: answer checking
// ---------------------------------------------------------------------------

function hasAnswer(item: RobinsINavItem, finalAnswers: ROBINSIChecklist): boolean {
  return robinsHasNavItemAnswer(item, finalAnswers);
}

function isAgreement(item: RobinsINavItem, comparison: ComparisonResult | null): boolean {
  return robinsIsNavItemAgreement(item, comparison);
}

// ---------------------------------------------------------------------------
// Adapter: write operations
// ---------------------------------------------------------------------------

function autoFillFromReviewer1(
  item: RobinsINavItem,
  checklist1: ROBINSIChecklist | null,
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
  setTextValue: (ref: TextRef, text: string) => void,
): void {
  switch (item.type) {
    case NAV_ITEM_TYPES.SECTION_B: {
      const sectionB = checklist1?.sectionB;
      const answer = sectionB?.[item.key as keyof typeof sectionB];
      if (!answer || typeof answer !== 'object' || !('answer' in answer)) return;
      const qa = answer as ROBINSIQuestionAnswer;
      updateSectionBAnswer(updateChecklistAnswer, item.key, qa.answer!);
      setTextValue(
        { type: 'ROBINS_I', sectionKey: 'sectionB', fieldKey: 'comment', questionKey: item.key },
        qa.comment || '',
      );
      return;
    }
    case NAV_ITEM_TYPES.DOMAIN_QUESTION: {
      const domain = checklist1?.[item.domainKey] as ROBINSIDomainState | undefined;
      const answer = domain?.answers?.[item.key];
      if (!answer) return;
      updateDomainQuestionAnswer(updateChecklistAnswer, item.domainKey, item.key, answer.answer!);
      setTextValue(
        {
          type: 'ROBINS_I',
          sectionKey: item.domainKey,
          fieldKey: 'comment',
          questionKey: item.key,
        },
        answer.comment || '',
      );
      return;
    }
    case NAV_ITEM_TYPES.DOMAIN_JUDGEMENT: {
      const domain = checklist1?.[item.domainKey] as ROBINSIDomainState | undefined;
      if (domain?.judgement) {
        updateDomainJudgement(
          updateChecklistAnswer,
          item.domainKey,
          domain.judgement,
          domain.direction,
        );
      }
      return;
    }
    case NAV_ITEM_TYPES.OVERALL_JUDGEMENT: {
      const overall = checklist1?.overall;
      if (overall?.judgement) {
        updateOverallJudgement(updateChecklistAnswer, overall.judgement, overall.direction);
      }
      return;
    }
  }
}

function resetAllAnswers(updateChecklistAnswer: (sectionKey: string, data: unknown) => void): void {
  const sectionBKeys = getSectionBKeys();
  const emptySectionB: Record<string, ROBINSIQuestionAnswer> = {};
  sectionBKeys.forEach((key: string) => {
    emptySectionB[key] = { answer: null, comment: '' };
  });
  updateChecklistAnswer('sectionB', emptySectionB);

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

function renderPage(
  context: EngineContext<ROBINSIChecklist, ROBINSIChecklist, ComparisonResult | null, RobinsINavItem>,
) {
  const {
    currentItem,
    checklist1: c1,
    checklist2: c2,
    finalAnswers: fa,
    comparison,
    getTextRef,
  } = context;

  if (currentItem.type === NAV_ITEM_TYPES.SECTION_B) {
    const c1SectionB = c1?.sectionB;
    const c2SectionB = c2?.sectionB;
    const faSectionB = fa.sectionB;
    return (
      <SectionBQuestionPage
        questionKey={currentItem.key}
        reviewer1Data={
          c1SectionB?.[currentItem.key as keyof typeof c1SectionB] as
            | ROBINSIQuestionAnswer
            | undefined
        }
        reviewer2Data={
          c2SectionB?.[currentItem.key as keyof typeof c2SectionB] as
            | ROBINSIQuestionAnswer
            | undefined
        }
        finalData={
          faSectionB?.[currentItem.key as keyof typeof faSectionB] as
            | ROBINSIQuestionAnswer
            | undefined
        }
        finalCommentYText={getTextRef({
          type: 'ROBINS_I',
          sectionKey: 'sectionB',
          fieldKey: 'comment',
          questionKey: currentItem.key,
        })}
        reviewer1Name={context.reviewer1Name}
        reviewer2Name={context.reviewer2Name}
        isAgreement={context.isAgreement}
        onFinalAnswerChange={answer =>
          updateSectionBAnswer(context.updateChecklistAnswer, currentItem.key, answer)
        }
        onUseReviewer1={() => {
          const data = c1SectionB?.[currentItem.key as keyof typeof c1SectionB] as
            | ROBINSIQuestionAnswer
            | undefined;
          if (data) {
            updateSectionBAnswer(context.updateChecklistAnswer, currentItem.key, data.answer!);
            context.setTextValue(
              {
                type: 'ROBINS_I',
                sectionKey: 'sectionB',
                fieldKey: 'comment',
                questionKey: currentItem.key,
              },
              data.comment || '',
            );
          }
        }}
        onUseReviewer2={() => {
          const data = c2SectionB?.[currentItem.key as keyof typeof c2SectionB] as
            | ROBINSIQuestionAnswer
            | undefined;
          if (data) {
            updateSectionBAnswer(context.updateChecklistAnswer, currentItem.key, data.answer!);
            context.setTextValue(
              {
                type: 'ROBINS_I',
                sectionKey: 'sectionB',
                fieldKey: 'comment',
                questionKey: currentItem.key,
              },
              data.comment || '',
            );
          }
        }}
      />
    );
  }

  if (currentItem.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
    const { domainKey, key: questionKey } = currentItem;
    const c1Domain = c1?.[domainKey] as ROBINSIDomainState | undefined;
    const c2Domain = c2?.[domainKey] as ROBINSIDomainState | undefined;
    const faDomain = fa[domainKey] as ROBINSIDomainState | undefined;
    return (
      <DomainQuestionPage
        domainKey={domainKey}
        questionKey={questionKey}
        reviewer1Data={c1Domain?.answers?.[questionKey]}
        reviewer2Data={c2Domain?.answers?.[questionKey]}
        finalData={faDomain?.answers?.[questionKey]}
        finalCommentYText={getTextRef({
          type: 'ROBINS_I',
          sectionKey: domainKey,
          fieldKey: 'comment',
          questionKey,
        })}
        reviewer1Name={context.reviewer1Name}
        reviewer2Name={context.reviewer2Name}
        isAgreement={context.isAgreement}
        onFinalAnswerChange={answer =>
          updateDomainQuestionAnswer(context.updateChecklistAnswer, domainKey, questionKey, answer)
        }
        onUseReviewer1={() => {
          const data = c1Domain?.answers?.[questionKey];
          if (!data) return;
          updateDomainQuestionAnswer(
            context.updateChecklistAnswer,
            domainKey,
            questionKey,
            data.answer!,
          );
          context.setTextValue(
            { type: 'ROBINS_I', sectionKey: domainKey, fieldKey: 'comment', questionKey },
            data.comment || '',
          );
        }}
        onUseReviewer2={() => {
          const data = c2Domain?.answers?.[questionKey];
          if (!data) return;
          updateDomainQuestionAnswer(
            context.updateChecklistAnswer,
            domainKey,
            questionKey,
            data.answer!,
          );
          context.setTextValue(
            { type: 'ROBINS_I', sectionKey: domainKey, fieldKey: 'comment', questionKey },
            data.comment || '',
          );
        }}
      />
    );
  }

  if (currentItem.type === NAV_ITEM_TYPES.DOMAIN_JUDGEMENT) {
    const { domainKey } = currentItem;
    const c1Domain = c1?.[domainKey] as ROBINSIDomainState | undefined;
    const c2Domain = c2?.[domainKey] as ROBINSIDomainState | undefined;
    const faDomain = fa[domainKey] as ROBINSIDomainState | undefined;
    const domainComp = comparison?.domains?.[domainKey];
    return (
      <DomainJudgementPage
        domainKey={domainKey}
        reviewer1Data={c1Domain}
        reviewer2Data={c2Domain}
        finalData={faDomain}
        reviewer1Name={context.reviewer1Name}
        reviewer2Name={context.reviewer2Name}
        judgementMatch={domainComp?.judgementMatch}
        directionMatch={domainComp?.directionMatch}
        onFinalJudgementChange={judgement =>
          updateDomainJudgement(
            context.updateChecklistAnswer,
            domainKey,
            judgement,
            faDomain?.direction,
          )
        }
        onFinalDirectionChange={direction =>
          updateDomainJudgement(
            context.updateChecklistAnswer,
            domainKey,
            faDomain?.judgement,
            direction,
          )
        }
        onUseReviewer1Judgement={() => {
          if (c1Domain)
            updateDomainJudgement(
              context.updateChecklistAnswer,
              domainKey,
              c1Domain.judgement,
              faDomain?.direction,
            );
        }}
        onUseReviewer2Judgement={() => {
          if (c2Domain)
            updateDomainJudgement(
              context.updateChecklistAnswer,
              domainKey,
              c2Domain.judgement,
              faDomain?.direction,
            );
        }}
        onUseReviewer1Direction={() => {
          if (c1Domain)
            updateDomainJudgement(
              context.updateChecklistAnswer,
              domainKey,
              faDomain?.judgement,
              c1Domain.direction,
            );
        }}
        onUseReviewer2Direction={() => {
          if (c2Domain)
            updateDomainJudgement(
              context.updateChecklistAnswer,
              domainKey,
              faDomain?.judgement,
              c2Domain.direction,
            );
        }}
      />
    );
  }

  if (currentItem.type === NAV_ITEM_TYPES.OVERALL_JUDGEMENT) {
    const overallComp = comparison?.overall;
    return (
      <OverallJudgementPage
        reviewer1Data={c1?.overall}
        reviewer2Data={c2?.overall}
        finalData={fa.overall}
        reviewer1Name={context.reviewer1Name}
        reviewer2Name={context.reviewer2Name}
        judgementMatch={overallComp?.judgementMatch}
        directionMatch={overallComp?.directionMatch}
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

  return assertNever(currentItem);
}

// ---------------------------------------------------------------------------
// Adapter: NavbarComponent wrapper
// ---------------------------------------------------------------------------

function RobinsINavbarAdapter(
  navbarContext: NavbarContext<ROBINSIChecklist, ComparisonResult | null, RobinsINavItem>,
) {
  const sectionBCrit = isSectionBCritical(
    navbarContext.finalAnswers?.sectionB as unknown as Parameters<typeof isSectionBCritical>[0],
  );

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

function RobinsISummaryAdapter(
  summaryContext: SummaryContext<ROBINSIChecklist, ComparisonResult | null, RobinsINavItem>,
) {
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

function renderWarningBanner(
  checklist1: ROBINSIChecklist | null,
  checklist2: ROBINSIChecklist | null,
) {
  const critical1 = isSectionBCritical(
    checklist1?.sectionB as Parameters<typeof isSectionBCritical>[0],
  );
  const critical2 = isSectionBCritical(
    checklist2?.sectionB as Parameters<typeof isSectionBCritical>[0],
  );

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

export const robinsIAdapter: ReconciliationAdapter<
  ROBINSIChecklist,
  ROBINSIChecklist,
  ComparisonResult | null,
  RobinsINavItem
> = {
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
