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
  ReconciliationNavItem,
  EngineContext,
  NavbarContext,
  SummaryContext,
} from '../engine/types';
import {
  compareChecklists,
  hasAimMismatch,
  getActiveDomainKeys,
  getDomainQuestions,
  scoreRob2Domain,
} from '@corates/shared/checklists/rob2';
import {
  buildNavigationItems,
  hasNavItemAnswer as rob2HasNavItemAnswer,
  isNavItemAgreement as rob2IsNavItemAgreement,
  NAV_ITEM_TYPES,
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
  value: any,
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
  finalAnswers: any,
  isAdhering: boolean,
  navItems: any[],
): Set<string> {
  const activeDomains = getActiveDomainKeys(isAdhering);
  const earlyCompleteDomains = new Set<string>();

  for (const domainKey of activeDomains) {
    const domainAnswers = finalAnswers[domainKey]?.answers;
    if (!domainAnswers) continue;

    const scoring = scoreRob2Domain(domainKey, domainAnswers);
    if (scoring.isComplete && scoring.judgement !== null) {
      const items = navItems.filter(
        (item: any) => item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && item.domainKey === domainKey,
      );
      const hasSkippedQuestion = items.some((item: any) => {
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
    const domainAnswers = finalAnswers[domainKey]?.answers || {};
    const items = navItems.filter(
      (item: any) => item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && item.domainKey === domainKey,
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
// Comparison helpers
// ---------------------------------------------------------------------------

function getCurrentItemComparison(item: any, comparison: any): any {
  if (!item || !comparison) return null;

  if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
    return comparison.preliminary?.fields?.find((f: any) => f.key === item.key);
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
  if (item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION) {
    return comparison.domains?.[item.domainKey];
  }
  if (item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
    return comparison.overall;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Adapter: data derivation
// ---------------------------------------------------------------------------

function buildNavItems(reconciledChecklist: unknown): ReconciliationNavItem[] {
  const rc = reconciledChecklist as any;
  const isAdhering = rc?.preliminary?.aim === 'ADHERING';
  const items = buildNavigationItems(isAdhering);
  // The existing buildNavigationItems already returns objects with type, key, label,
  // section, domainKey - which map directly to ReconciliationNavItem
  return items as ReconciliationNavItem[];
}

function deriveFinalAnswers(reconciledChecklist: unknown): unknown {
  return reconciledChecklist || {};
}

function compare(checklist1: unknown, checklist2: unknown, reconciledChecklist: unknown): unknown {
  if (!checklist1 || !checklist2) return null;
  const reconciledAim = (reconciledChecklist as any)?.preliminary?.aim;
  return compareChecklists(checklist1 as any, checklist2 as any, reconciledAim);
}

// ---------------------------------------------------------------------------
// Adapter: answer checking
// ---------------------------------------------------------------------------

function hasAnswer(item: ReconciliationNavItem, finalAnswers: unknown): boolean {
  return rob2HasNavItemAnswer(item as any, finalAnswers as any);
}

function isAgreement(item: ReconciliationNavItem, comparison: unknown): boolean {
  return rob2IsNavItemAgreement(item as any, comparison as any);
}

// ---------------------------------------------------------------------------
// Adapter: write operations
// ---------------------------------------------------------------------------

function autoFillFromReviewer1(
  item: ReconciliationNavItem,
  checklist1: unknown,
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
  _getTextRef: ((...args: unknown[]) => unknown) | null,
  setTextValue?:
    | ((
        params: { sectionKey?: string; fieldKey?: string; questionKey?: string },
        text: string,
      ) => void)
    | null,
): void {
  const c1 = checklist1 as any;

  if (item.type === NAV_ITEM_TYPES.PRELIMINARY) {
    const value = c1?.preliminary?.[item.key];
    if (value !== undefined) {
      // Always update finalAnswers so hasNavItemAnswer works even if page is unmounted
      updatePreliminaryField(updateChecklistAnswer, item.key, value);
      if (PRELIMINARY_TEXT_FIELDS.includes(item.key)) {
        setTextValue?.(
          { sectionKey: 'preliminary', fieldKey: item.key },
          typeof value === 'string' ? value : '',
        );
      }
    }
  } else if (item.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && item.domainKey) {
    const answer = c1?.[item.domainKey]?.answers?.[item.key];
    if (answer) {
      updateDomainQuestionAnswer(updateChecklistAnswer, item.domainKey, item.key, answer.answer);
      setTextValue?.(
        { sectionKey: item.domainKey, fieldKey: 'comment', questionKey: item.key },
        answer.comment || '',
      );
    }
  } else if (item.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION && item.domainKey) {
    const direction = c1?.[item.domainKey]?.direction;
    if (direction) {
      updateDomainDirection(updateChecklistAnswer, item.domainKey!, direction);
    }
  } else if (item.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
    const direction = c1?.overall?.direction;
    if (direction) {
      updateOverallDirection(updateChecklistAnswer, direction);
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
    const answers: Record<string, any> = {};
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
  navItems: ReconciliationNavItem[],
  finalAnswers: unknown,
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
): void {
  const fa = finalAnswers as any;
  const isAdhering = fa?.preliminary?.aim === 'ADHERING';
  const skippable = getSkippableQuestions(fa, isAdhering, navItems as any[]);

  if (skippable.size === 0) return;

  for (const qKey of skippable) {
    const item = navItems.find(i => i.type === NAV_ITEM_TYPES.DOMAIN_QUESTION && i.key === qKey);
    if (!item) continue;

    const currentAnswer = fa[item.domainKey!]?.answers?.[qKey]?.answer;
    if (currentAnswer == null) {
      updateDomainQuestionAnswer(updateChecklistAnswer, item.domainKey!, qKey, 'NA');
    }
  }
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
  const isAdhering = fa?.preliminary?.aim === 'ADHERING';
  const skippable = getSkippableQuestions(fa, isAdhering, context.navItems as any[]);

  if (currentItem.type === NAV_ITEM_TYPES.PRELIMINARY) {
    return (
      <PreliminaryPage
        key={currentItem.key}
        fieldKey={currentItem.key}
        reviewer1Value={c1?.preliminary?.[currentItem.key]}
        reviewer2Value={c2?.preliminary?.[currentItem.key]}
        finalValue={fa.preliminary?.[currentItem.key]}
        reviewer1Name={context.reviewer1Name || 'Reviewer 1'}
        reviewer2Name={context.reviewer2Name || 'Reviewer 2'}
        isAgreement={context.isAgreement}
        isAimMismatch={currentItem.key === 'aim' && hasAimMismatch(c1, c2) && !fa?.preliminary?.aim}
        onFinalChange={(value: any) =>
          updatePreliminaryField(context.updateChecklistAnswer, currentItem.key, value)
        }
        getRob2Text={getTextRef as any}
        onUseReviewer1={() => {
          const value = c1?.preliminary?.[currentItem.key];
          if (value !== undefined) {
            // Always update finalAnswers so hasNavItemAnswer detects the field as answered
            // even if the page unmounts before the Y.Text observer fires.
            updatePreliminaryField(context.updateChecklistAnswer, currentItem.key, value);
            if (PRELIMINARY_TEXT_FIELDS.includes(currentItem.key)) {
              // Also write to Y.Text for the NoteEditor. The equality check in
              // setYTextField prevents a feedback loop (setTextValue -> updateChecklistAnswer
              // -> setYTextField sees same value -> skips).
              context.setTextValue?.(
                { sectionKey: 'preliminary', fieldKey: currentItem.key },
                typeof value === 'string' ? value : '',
              );
            }
          }
        }}
        onUseReviewer2={() => {
          const value = c2?.preliminary?.[currentItem.key];
          if (value !== undefined) {
            updatePreliminaryField(context.updateChecklistAnswer, currentItem.key, value);
            if (PRELIMINARY_TEXT_FIELDS.includes(currentItem.key)) {
              context.setTextValue?.(
                { sectionKey: 'preliminary', fieldKey: currentItem.key },
                typeof value === 'string' ? value : '',
              );
            }
          }
        }}
      />
    );
  }

  if (currentItem.type === NAV_ITEM_TYPES.DOMAIN_QUESTION) {
    return (
      <SignallingQuestionPage
        domainKey={currentItem.domainKey!}
        questionKey={currentItem.key}
        reviewer1Data={c1?.[currentItem.domainKey!]?.answers?.[currentItem.key]}
        reviewer2Data={c2?.[currentItem.domainKey!]?.answers?.[currentItem.key]}
        finalData={fa[currentItem.domainKey!]?.answers?.[currentItem.key]}
        finalCommentYText={getTextRef?.(currentItem.domainKey!, 'comment', currentItem.key)}
        reviewer1Name={context.reviewer1Name || 'Reviewer 1'}
        reviewer2Name={context.reviewer2Name || 'Reviewer 2'}
        isAgreement={context.isAgreement}
        isSkipped={skippable.has(currentItem.key)}
        onFinalAnswerChange={(answer: string) =>
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
            context.setTextValue?.(
              {
                sectionKey: currentItem.domainKey!,
                fieldKey: 'comment',
                questionKey: currentItem.key,
              },
              data.comment || '',
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
            context.setTextValue?.(
              {
                sectionKey: currentItem.domainKey!,
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

  if (currentItem.type === NAV_ITEM_TYPES.DOMAIN_DIRECTION) {
    return (
      <DomainDirectionPage
        domainKey={currentItem.domainKey!}
        reviewer1Answers={c1?.[currentItem.domainKey!]?.answers}
        reviewer2Answers={c2?.[currentItem.domainKey!]?.answers}
        finalAnswers={fa[currentItem.domainKey!]?.answers}
        reviewer1Direction={c1?.[currentItem.domainKey!]?.direction}
        reviewer2Direction={c2?.[currentItem.domainKey!]?.direction}
        finalDirection={fa[currentItem.domainKey!]?.direction}
        reviewer1Name={context.reviewer1Name || 'Reviewer 1'}
        reviewer2Name={context.reviewer2Name || 'Reviewer 2'}
        directionMatch={itemComparison?.directionMatch}
        onFinalDirectionChange={(direction: string) =>
          updateDomainDirection(context.updateChecklistAnswer, currentItem.domainKey!, direction)
        }
        onUseReviewer1={() => {
          const direction = c1?.[currentItem.domainKey!]?.direction;
          if (direction) {
            updateDomainDirection(context.updateChecklistAnswer, currentItem.domainKey!, direction);
          }
        }}
        onUseReviewer2={() => {
          const direction = c2?.[currentItem.domainKey!]?.direction;
          if (direction) {
            updateDomainDirection(context.updateChecklistAnswer, currentItem.domainKey!, direction);
          }
        }}
      />
    );
  }

  if (currentItem.type === NAV_ITEM_TYPES.OVERALL_DIRECTION) {
    return (
      <OverallDirectionPage
        checklist1={c1}
        checklist2={c2}
        finalChecklist={fa}
        reviewer1Direction={c1?.overall?.direction}
        reviewer2Direction={c2?.overall?.direction}
        finalDirection={fa.overall?.direction}
        reviewer1Name={context.reviewer1Name || 'Reviewer 1'}
        reviewer2Name={context.reviewer2Name || 'Reviewer 2'}
        directionMatch={itemComparison?.directionMatch}
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

  return <div className='py-12 text-center'>Unknown item type</div>;
}

// ---------------------------------------------------------------------------
// Adapter: NavbarComponent wrapper
// ---------------------------------------------------------------------------

function Rob2NavbarAdapter(navbarContext: NavbarContext) {
  const fa = navbarContext.finalAnswers as any;
  const isAdhering = fa?.preliminary?.aim === 'ADHERING';
  const skippable = getSkippableQuestions(fa, isAdhering, navbarContext.navItems as any[]);

  // Derive aimMismatch from comparison data (the comparison already knows if reviewers
  // disagree on aim) and finalAnswers (mismatch is resolved once a final aim is set)
  const comp = navbarContext.comparison as any;
  const aimField = comp?.preliminary?.fields?.find((f: any) => f.key === 'aim');
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

function Rob2SummaryAdapter(summaryContext: SummaryContext) {
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
  checklist1: unknown,
  checklist2: unknown,
  reconciledChecklist: unknown,
) {
  const c1 = checklist1 as any;
  const c2 = checklist2 as any;
  const reviewersMismatch = hasAimMismatch(c1, c2);
  if (!reviewersMismatch) return null;

  const finalAim = (reconciledChecklist as any)?.preliminary?.aim;
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

export const rob2Adapter: ReconciliationAdapter = {
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
