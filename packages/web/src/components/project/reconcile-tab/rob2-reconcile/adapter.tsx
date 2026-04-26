/**
 * ROB2 Reconciliation Adapter
 *
 * Implements ReconciliationAdapter for ROB-2 checklists.
 * Handles preliminary fields, domain signalling questions, domain directions,
 * overall direction, skippable questions, and aim mismatch detection.
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
import type { ROB2Checklist, ROB2DomainState, ROB2QuestionAnswer } from '@corates/shared/checklists';
import {
  compareChecklists,
  hasAimMismatch,
  getActiveDomainKeys,
  getDomainQuestions,
  scoreRob2Domain,
  type ComparisonResult,
  type DomainComparison,
  type OverallComparison,
} from '@corates/shared/checklists/rob2';
import {
  buildNavigationItems,
  hasNavItemAnswer as rob2HasNavItemAnswer,
  isNavItemAgreement as rob2IsNavItemAgreement,
  NAV_ITEM_TYPES,
  type Rob2NavItem,
} from './navbar-utils.js';
import { PreliminaryPage } from './pages/PreliminaryPage';
import { SignallingQuestionPage } from './pages/SignallingQuestionPage';
import { DomainDirectionPage } from './pages/DomainDirectionPage';
import { OverallDirectionPage } from './pages/OverallDirectionPage';
import { ROB2Navbar } from './ROB2Navbar';
import { ROB2SummaryView } from './ROB2SummaryView';

const PRELIMINARY_TEXT_FIELDS = ['experimental', 'comparator', 'numericalResult'];

// ---------------------------------------------------------------------------
// Update helpers
// ---------------------------------------------------------------------------

function updatePreliminaryField(
  updateChecklistAnswer: (s: string, d: unknown) => void,
  key: string,
  value: unknown,
) {
  updateChecklistAnswer('preliminary', { [key]: value });
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

function updateDomainDirection(
  updateChecklistAnswer: (s: string, d: unknown) => void,
  domainKey: string,
  direction: string,
) {
  updateChecklistAnswer(domainKey, { direction });
}

function updateOverallDirection(
  updateChecklistAnswer: (s: string, d: unknown) => void,
  direction: string,
) {
  updateChecklistAnswer('overall', { direction });
}

// ---------------------------------------------------------------------------
// Skippable questions detection
// ---------------------------------------------------------------------------

function getSkippableQuestions(
  finalAnswers: ROB2Checklist,
  isAdhering: boolean,
  navItems: Rob2NavItem[],
): Set<string> {
  const activeDomains = getActiveDomainKeys(isAdhering);
  const earlyCompleteDomains = new Set<string>();

  for (const domainKey of activeDomains) {
    const domain = finalAnswers[domainKey] as ROB2DomainState | undefined;
    const domainAnswers = domain?.answers;
    if (!domainAnswers) continue;

    const scoring = scoreRob2Domain(domainKey, domainAnswers);
    if (scoring.isComplete && scoring.judgement !== null) {
      const items = navItems.filter(
        item => item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && item.domainKey === domainKey,
      );
      const hasSkippedQuestion = items.some(item => {
        const answer = domainAnswers[item.key]?.answer;
        return !answer || answer === 'NA';
      });
      if (hasSkippedQuestion) {
        earlyCompleteDomains.add(domainKey);
      }
    }
  }

  const skippable = new Set<string>();
  for (const domainKey of earlyCompleteDomains) {
    const domain = finalAnswers[domainKey] as ROB2DomainState;
    const domainAnswers = domain.answers;
    const items = navItems.filter(
      item => item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && item.domainKey === domainKey,
    );
    for (const item of items) {
      const answer = domainAnswers[item.key]?.answer;
      if (!answer || answer === 'NA') {
        skippable.add(item.key);
      }
    }
  }

  return skippable;
}

// ---------------------------------------------------------------------------
// Adapter: data derivation
// ---------------------------------------------------------------------------

function buildNavItems(reconciledChecklist: ROB2Checklist | null): Rob2NavItem[] {
  const isAdhering = reconciledChecklist?.preliminary?.aim === 'ADHERING';
  return buildNavigationItems(isAdhering);
}

function deriveFinalAnswers(reconciledChecklist: ROB2Checklist | null): ROB2Checklist {
  return (reconciledChecklist || {}) as ROB2Checklist;
}

function compare(
  checklist1: ROB2Checklist | null,
  checklist2: ROB2Checklist | null,
  reconciledChecklist: ROB2Checklist | null,
): ComparisonResult | null {
  if (!checklist1 || !checklist2) return null;
  const reconciledAim = reconciledChecklist?.preliminary?.aim;
  return compareChecklists(checklist1, checklist2, reconciledAim);
}

// ---------------------------------------------------------------------------
// Adapter: answer checking
// ---------------------------------------------------------------------------

function hasAnswer(item: Rob2NavItem, finalAnswers: ROB2Checklist): boolean {
  return rob2HasNavItemAnswer(item, finalAnswers);
}

function isAgreement(item: Rob2NavItem, comparison: ComparisonResult | null): boolean {
  return rob2IsNavItemAgreement(item, comparison);
}

// ---------------------------------------------------------------------------
// Adapter: write operations
// ---------------------------------------------------------------------------

function autoFillFromReviewer1(
  item: Rob2NavItem,
  checklist1: ROB2Checklist | null,
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
  setTextValue: (ref: TextRef, text: string) => void,
): void {
  switch (item.type) {
    case NAV_ITEM_TYPES.PRELIMINARY: {
      const value = checklist1?.preliminary?.[item.key as keyof ROB2Checklist['preliminary']];
      if (value === undefined) return;
      updatePreliminaryField(updateChecklistAnswer, item.key, value);
      if (PRELIMINARY_TEXT_FIELDS.includes(item.key)) {
        setTextValue(
          { type: 'ROB2', sectionKey: 'preliminary', fieldKey: item.key },
          typeof value === 'string' ? value : '',
        );
      }
      return;
    }
    case NAV_ITEM_TYPES.DOMAIN_QUESTION: {
      const domain = checklist1?.[item.domainKey] as ROB2DomainState | undefined;
      const answer = domain?.answers?.[item.key];
      if (!answer) return;
      updateDomainQuestionAnswer(updateChecklistAnswer, item.domainKey, item.key, answer.answer!);
      setTextValue(
        {
          type: 'ROB2',
          sectionKey: item.domainKey,
          fieldKey: 'comment',
          questionKey: item.key,
        },
        answer.comment || '',
      );
      return;
    }
    case NAV_ITEM_TYPES.DOMAIN_DIRECTION: {
      const domain = checklist1?.[item.domainKey] as ROB2DomainState | undefined;
      const direction = domain?.direction;
      if (direction) updateDomainDirection(updateChecklistAnswer, item.domainKey, direction);
      return;
    }
    case NAV_ITEM_TYPES.OVERALL_DIRECTION: {
      const direction = checklist1?.overall?.direction;
      if (direction) updateOverallDirection(updateChecklistAnswer, direction);
      return;
    }
  }
}

function resetAllAnswers(updateChecklistAnswer: (sectionKey: string, data: unknown) => void): void {
  updateChecklistAnswer('preliminary', {
    studyDesign: null,
    aim: null,
    deviationsToAddress: [],
    sources: {},
    experimental: '',
    comparator: '',
    numericalResult: '',
  });

  const allDomains = ['domain1', 'domain2a', 'domain2b', 'domain3', 'domain4', 'domain5'];
  for (const domainKey of allDomains) {
    const questionKeys = Object.keys(getDomainQuestions(domainKey));
    const answers: Record<string, ROB2QuestionAnswer> = {};
    for (const qKey of questionKeys) {
      answers[qKey] = { answer: null, comment: '' };
    }
    updateChecklistAnswer(domainKey, {
      answers,
      direction: null,
      judgement: null,
    });
  }

  updateChecklistAnswer('overall', {
    direction: null,
    judgement: null,
  });
}

// ---------------------------------------------------------------------------
// Adapter: onAfterNavigate (skippable questions auto-NA)
// ---------------------------------------------------------------------------

function onAfterNavigate(
  navItems: Rob2NavItem[],
  finalAnswers: ROB2Checklist,
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
): void {
  const isAdhering = finalAnswers?.preliminary?.aim === 'ADHERING';
  const skippable = getSkippableQuestions(finalAnswers, isAdhering, navItems);

  if (skippable.size === 0) return;

  for (const qKey of skippable) {
    const item = navItems.find(
      (i): i is Extract<Rob2NavItem, { type: 'domainQuestion' }> =>
        i.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && i.key === qKey,
    );
    if (!item) continue;

    const domain = finalAnswers[item.domainKey] as ROB2DomainState | undefined;
    const currentAnswer = domain?.answers?.[qKey]?.answer;
    if (currentAnswer == null) {
      updateDomainQuestionAnswer(updateChecklistAnswer, item.domainKey, qKey, 'NA');
    }
  }
}

// ---------------------------------------------------------------------------
// Adapter: renderPage
// ---------------------------------------------------------------------------

function renderPage(
  context: EngineContext<ROB2Checklist, ROB2Checklist, ComparisonResult | null, Rob2NavItem>,
) {
  const {
    currentItem,
    checklist1: c1,
    checklist2: c2,
    finalAnswers: fa,
    comparison,
    getTextRef,
  } = context;
  const isAdhering = fa?.preliminary?.aim === 'ADHERING';
  const skippable = getSkippableQuestions(fa, isAdhering, context.navItems);

  if (currentItem.type === NAV_ITEM_TYPES.PRELIMINARY) {
    const r1Value = c1?.preliminary?.[currentItem.key as keyof ROB2Checklist['preliminary']];
    const r2Value = c2?.preliminary?.[currentItem.key as keyof ROB2Checklist['preliminary']];
    return (
      <PreliminaryPage
        key={currentItem.key}
        fieldKey={currentItem.key}
        reviewer1Value={r1Value}
        reviewer2Value={r2Value}
        finalValue={fa.preliminary?.[currentItem.key as keyof ROB2Checklist['preliminary']]}
        reviewer1Name={context.reviewer1Name}
        reviewer2Name={context.reviewer2Name}
        isAgreement={context.isAgreement}
        isAimMismatch={
          currentItem.key === 'aim' &&
          hasAimMismatch(c1, c2) &&
          !fa?.preliminary?.aim
        }
        onFinalChange={(value: unknown) =>
          updatePreliminaryField(context.updateChecklistAnswer, currentItem.key, value)
        }
        getTextRef={getTextRef}
        onUseReviewer1={() => {
          const value = c1?.preliminary?.[currentItem.key as keyof ROB2Checklist['preliminary']];
          if (value !== undefined) {
            updatePreliminaryField(context.updateChecklistAnswer, currentItem.key, value);
            if (PRELIMINARY_TEXT_FIELDS.includes(currentItem.key)) {
              context.setTextValue(
                { type: 'ROB2', sectionKey: 'preliminary', fieldKey: currentItem.key },
                typeof value === 'string' ? value : '',
              );
            }
          }
        }}
        onUseReviewer2={() => {
          const value = c2?.preliminary?.[currentItem.key as keyof ROB2Checklist['preliminary']];
          if (value !== undefined) {
            updatePreliminaryField(context.updateChecklistAnswer, currentItem.key, value);
            if (PRELIMINARY_TEXT_FIELDS.includes(currentItem.key)) {
              context.setTextValue(
                { type: 'ROB2', sectionKey: 'preliminary', fieldKey: currentItem.key },
                typeof value === 'string' ? value : '',
              );
            }
          }
        }}
      />
    );
  }

  if (currentItem.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
    const { domainKey, key: questionKey } = currentItem;
    const c1Domain = c1?.[domainKey] as ROB2DomainState | undefined;
    const c2Domain = c2?.[domainKey] as ROB2DomainState | undefined;
    const faDomain = fa[domainKey] as ROB2DomainState | undefined;
    return (
      <SignallingQuestionPage
        domainKey={domainKey}
        questionKey={questionKey}
        reviewer1Data={c1Domain?.answers?.[questionKey]}
        reviewer2Data={c2Domain?.answers?.[questionKey]}
        finalData={faDomain?.answers?.[questionKey]}
        finalCommentYText={getTextRef({
          type: 'ROB2',
          sectionKey: domainKey,
          fieldKey: 'comment',
          questionKey,
        })}
        reviewer1Name={context.reviewer1Name}
        reviewer2Name={context.reviewer2Name}
        isAgreement={context.isAgreement}
        isSkipped={skippable.has(questionKey)}
        onFinalAnswerChange={(answer: string) =>
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
            { type: 'ROB2', sectionKey: domainKey, fieldKey: 'comment', questionKey },
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
            { type: 'ROB2', sectionKey: domainKey, fieldKey: 'comment', questionKey },
            data.comment || '',
          );
        }}
      />
    );
  }

  if (currentItem.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION) {
    const { domainKey } = currentItem;
    const c1Domain = c1?.[domainKey] as ROB2DomainState | undefined;
    const c2Domain = c2?.[domainKey] as ROB2DomainState | undefined;
    const faDomain = fa[domainKey] as ROB2DomainState | undefined;
    const domainComp: DomainComparison | undefined = comparison?.domains?.[domainKey];
    return (
      <DomainDirectionPage
        domainKey={domainKey}
        reviewer1Answers={c1Domain?.answers}
        reviewer2Answers={c2Domain?.answers}
        finalAnswers={faDomain?.answers}
        reviewer1Direction={c1Domain?.direction ?? null}
        reviewer2Direction={c2Domain?.direction ?? null}
        finalDirection={faDomain?.direction ?? null}
        reviewer1Name={context.reviewer1Name}
        reviewer2Name={context.reviewer2Name}
        directionMatch={domainComp?.directionMatch ?? false}
        onFinalDirectionChange={(direction: string) =>
          updateDomainDirection(context.updateChecklistAnswer, domainKey, direction)
        }
        onUseReviewer1={() => {
          const direction = c1Domain?.direction;
          if (direction) updateDomainDirection(context.updateChecklistAnswer, domainKey, direction);
        }}
        onUseReviewer2={() => {
          const direction = c2Domain?.direction;
          if (direction) updateDomainDirection(context.updateChecklistAnswer, domainKey, direction);
        }}
      />
    );
  }

  if (currentItem.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
    const overallComp: OverallComparison | undefined = comparison?.overall;
    return (
      <OverallDirectionPage
        checklist1={c1}
        checklist2={c2}
        finalChecklist={fa}
        reviewer1Direction={c1?.overall?.direction ?? null}
        reviewer2Direction={c2?.overall?.direction ?? null}
        finalDirection={fa.overall?.direction ?? null}
        reviewer1Name={context.reviewer1Name}
        reviewer2Name={context.reviewer2Name}
        directionMatch={overallComp?.directionMatch ?? false}
        onFinalDirectionChange={(direction: string) =>
          updateOverallDirection(context.updateChecklistAnswer, direction)
        }
        onUseReviewer1={() => {
          const direction = c1?.overall?.direction;
          if (direction) {
            updateOverallDirection(context.updateChecklistAnswer, direction);
          }
        }}
        onUseReviewer2={() => {
          const direction = c2?.overall?.direction;
          if (direction) {
            updateOverallDirection(context.updateChecklistAnswer, direction);
          }
        }}
      />
    );
  }

  return assertNever(currentItem);
}

// ---------------------------------------------------------------------------
// Adapter: NavbarComponent wrapper
// ---------------------------------------------------------------------------

function Rob2NavbarAdapter(
  navbarContext: NavbarContext<ROB2Checklist, ComparisonResult | null, Rob2NavItem>,
) {
  const fa = navbarContext.finalAnswers;
  const isAdhering = fa?.preliminary?.aim === 'ADHERING';
  const skippable = getSkippableQuestions(fa, isAdhering, navbarContext.navItems);

  const comp = navbarContext.comparison;
  const aimField = comp?.preliminary?.fields?.find(f => f.key === 'aim');
  const aimMismatch = aimField ? !aimField.isAgreement && !fa?.preliminary?.aim : false;

  const store = {
    navItems: navbarContext.navItems,
    viewMode: navbarContext.viewMode,
    currentPage: navbarContext.currentPage,
    comparison: navbarContext.comparison,
    finalAnswers: navbarContext.finalAnswers,
    aimMismatch,
    expandedDomain: navbarContext.expandedDomain,
    skippableQuestions: skippable,
    setViewMode: navbarContext.setViewMode as (mode: string) => void,
    goToPage: navbarContext.goToPage,
    setExpandedDomain: navbarContext.setExpandedDomain as (domain: string) => void,
    onReset: navbarContext.onReset,
  };

  return <ROB2Navbar store={store} />;
}

// ---------------------------------------------------------------------------
// Adapter: SummaryComponent wrapper
// ---------------------------------------------------------------------------

function Rob2SummaryAdapter(
  summaryContext: SummaryContext<ROB2Checklist, ComparisonResult | null, Rob2NavItem>,
) {
  return (
    <ROB2SummaryView
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
  checklist1: ROB2Checklist | null,
  checklist2: ROB2Checklist | null,
  reconciledChecklist: ROB2Checklist | null,
) {
  const reviewersMismatch = hasAimMismatch(checklist1, checklist2);
  if (!reviewersMismatch) return null;

  const finalAim = reconciledChecklist?.preliminary?.aim;
  if (finalAim) return null;

  return (
    <div className='border-destructive/20 bg-destructive/10 text-destructive mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm'>
      <AlertTriangleIcon className='size-5 shrink-0' />
      <div>
        <span className='font-medium'>Aim Mismatch Detected:</span> Reviewers selected different
        aims. You must reconcile the aim field before proceeding to domain assessment.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export adapter
// ---------------------------------------------------------------------------

export const rob2Adapter: ReconciliationAdapter<
  ROB2Checklist,
  ROB2Checklist,
  ComparisonResult | null,
  Rob2NavItem
> = {
  checklistType: 'ROB2',
  title: 'ROB-2 Reconciliation',
  pageCounterLabel: 'Item',
  getPageLabel: (pageIndex: number) => `Item ${pageIndex + 1}`,

  buildNavItems,
  deriveFinalAnswers,
  compare,

  hasAnswer,
  isAgreement,

  autoFillFromReviewer1,
  resetAllAnswers,
  onAfterNavigate,

  renderPage,
  NavbarComponent: Rob2NavbarAdapter,
  SummaryComponent: Rob2SummaryAdapter,
  renderWarningBanner,
};
