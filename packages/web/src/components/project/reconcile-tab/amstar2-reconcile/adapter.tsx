/**
 * AMSTAR2 Reconciliation Adapter
 *
 * Implements ReconciliationAdapter for AMSTAR2 checklists.
 * Wraps existing page, navbar, and summary components.
 */

import type {
  ReconciliationAdapter,
  EngineContext,
  NavbarContext,
  SummaryContext,
} from '../engine/types';

export interface Amstar2NavItem {
  key: string;
  label: string;
  section: string;
  sectionKey: string;
  type: 'single' | 'multiPart';
  meta: { isMultiPart: boolean };
}
import {
  compareChecklists,
  getReconciliationSummary,
  getQuestionKeys,
  getDataKeysForQuestion,
  isMultiPartQuestion,
} from '@/components/checklist/AMSTAR2Checklist/checklist-compare.js';
import type { ComparisonResult } from '@corates/shared/checklists/amstar2';
import { createChecklist } from '@/components/checklist/AMSTAR2Checklist/checklist.js';
import { hasQuestionAnswer } from './navbar-utils.js';
import { ReconciliationQuestionPage } from './ReconciliationQuestionPage';
import { Navbar } from './Navbar';
import { SummaryView } from './SummaryView';

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

const questionKeys: string[] = getQuestionKeys();

function buildNavItems(): Amstar2NavItem[] {
  return questionKeys.map(key => ({
    key,
    label: key.replace('q', ''),
    section: 'Questions',
    sectionKey: 'questions',
    type: isMultiPartQuestion(key) ? 'multiPart' : 'single',
    meta: { isMultiPart: isMultiPartQuestion(key) },
  }));
}

// Pre-computed since AMSTAR2 nav items are static
const AMSTAR2_NAV_ITEMS = buildNavItems();

// ---------------------------------------------------------------------------
// Data derivation
// ---------------------------------------------------------------------------

function deriveFinalAnswers(reconciledChecklist: any): Record<string, any> {
  if (!reconciledChecklist) return {};
  const answers: Record<string, any> = {};

  for (const key of questionKeys) {
    if (isMultiPartQuestion(key)) {
      const dataKeys = getDataKeysForQuestion(key);
      const parts: Record<string, any> = {};
      let hasAnyPart = false;
      for (const dk of dataKeys) {
        if (reconciledChecklist[dk]) {
          parts[dk] = reconciledChecklist[dk];
          hasAnyPart = true;
        }
      }
      if (hasAnyPart) answers[key] = parts;
    } else {
      if (reconciledChecklist[key]) answers[key] = reconciledChecklist[key];
    }
  }

  return answers;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function compare(checklist1: any, checklist2: any): ComparisonResult | null {
  if (!checklist1 || !checklist2) return null;
  return compareChecklists(checklist1, checklist2);
}

// Build a lookup map for isAgreement checks
function buildComparisonByQuestion(comparison: ComparisonResult | null): Record<string, any> {
  if (!comparison) return {};
  const map: Record<string, any> = {};
  for (const item of [...comparison.agreements, ...comparison.disagreements]) {
    map[item.key] = item;
  }
  return map;
}

// ---------------------------------------------------------------------------
// Answer checking
// ---------------------------------------------------------------------------

function hasAnswer(item: Amstar2NavItem, finalAnswers: Record<string, any>): boolean {
  return hasQuestionAnswer(item.key, finalAnswers);
}

function isAgreement(item: Amstar2NavItem, comparison: ComparisonResult | null): boolean {
  const map = buildComparisonByQuestion(comparison);
  return map[item.key]?.isAgreement ?? true;
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

function getReviewerAnswers(checklist: any, questionKey: string): any {
  if (!checklist) return null;
  if (isMultiPartQuestion(questionKey)) {
    const dataKeys = getDataKeysForQuestion(questionKey);
    const parts: Record<string, any> = {};
    for (const dk of dataKeys) {
      parts[dk] = checklist[dk];
    }
    return parts;
  }
  return checklist[questionKey];
}

function writeAnswer(
  questionKey: string,
  answer: any,
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
) {
  if (isMultiPartQuestion(questionKey)) {
    const dataKeys = getDataKeysForQuestion(questionKey);
    for (const dk of dataKeys) {
      if (answer[dk]) updateChecklistAnswer(dk, answer[dk]);
    }
  } else {
    updateChecklistAnswer(questionKey, answer);
  }
}

function autoFillFromReviewer1(
  item: Amstar2NavItem,
  checklist1: any,
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
): void {
  const defaultAnswer = getReviewerAnswers(checklist1, item.key);
  if (defaultAnswer) {
    writeAnswer(item.key, JSON.parse(JSON.stringify(defaultAnswer)), updateChecklistAnswer);
  }
}

function resetAllAnswers(updateChecklistAnswer: (sectionKey: string, data: unknown) => void): void {
  const defaultChecklist = createChecklist({ name: 'temp', id: 'temp' }) as Record<string, any>;
  for (const key of questionKeys) {
    if (isMultiPartQuestion(key)) {
      const dataKeys = getDataKeysForQuestion(key);
      for (const dk of dataKeys) {
        if (defaultChecklist[dk]) updateChecklistAnswer(dk, defaultChecklist[dk]);
      }
    } else {
      if (defaultChecklist[key]) updateChecklistAnswer(key, defaultChecklist[key]);
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering: Page
// ---------------------------------------------------------------------------

function getReviewerNote(checklist: any, questionKey: string): string {
  if (!checklist) return '';
  const noteData = checklist[questionKey];
  if (noteData?.note !== undefined) {
    return typeof noteData.note === 'string' ? noteData.note : noteData.note?.toString?.() || '';
  }
  return '';
}

function renderPage(
  context: EngineContext<any, Record<string, any>, ComparisonResult | null, Amstar2NavItem>,
) {
  const {
    currentItem,
    checklist1,
    checklist2,
    finalAnswers: fa,
    isAgreement,
    getTextRef,
  } = context;
  const key = currentItem.key;

  // Derive currentFinalAnswer from reconciledChecklist for current question
  let currentFinalAnswer: any = null;
  if (isMultiPartQuestion(key)) {
    const dataKeys = getDataKeysForQuestion(key);
    const parts: Record<string, any> = {};
    let hasAnyPart = false;
    for (const dk of dataKeys) {
      if (fa[key]?.[dk]) {
        parts[dk] = fa[key][dk];
        hasAnyPart = true;
      }
    }
    currentFinalAnswer = hasAnyPart ? parts : null;
  } else {
    currentFinalAnswer = fa[key] || null;
  }

  function handleFinalChange(newAnswer: any) {
    writeAnswer(key, newAnswer, context.updateChecklistAnswer);
  }

  return (
    <ReconciliationQuestionPage
      questionKey={key}
      reviewer1Answers={getReviewerAnswers(checklist1, key)}
      reviewer2Answers={getReviewerAnswers(checklist2, key)}
      finalAnswers={currentFinalAnswer}
      onFinalChange={handleFinalChange}
      reviewer1Name={context.reviewer1Name || checklist1?.reviewerName || 'Reviewer 1'}
      reviewer2Name={context.reviewer2Name || checklist2?.reviewerName || 'Reviewer 2'}
      isAgreement={isAgreement}
      isMultiPart={!!currentItem.meta?.isMultiPart}
      reviewer1Note={getReviewerNote(checklist1, key)}
      reviewer2Note={getReviewerNote(checklist2, key)}
      finalNoteYText={getTextRef({ type: 'AMSTAR2', questionKey: key })}
    />
  );
}

// ---------------------------------------------------------------------------
// Rendering: Navbar wrapper
// ---------------------------------------------------------------------------

function Amstar2NavbarAdapter(
  navbarContext: NavbarContext<Record<string, any>, ComparisonResult | null, Amstar2NavItem>,
) {
  // Map NavbarContext to the shape the existing Navbar component expects
  const comparisonByQuestion = buildComparisonByQuestion(navbarContext.comparison);

  const store = {
    questionKeys: navbarContext.navItems.map(item => item.key),
    viewMode: navbarContext.viewMode,
    currentPage: navbarContext.currentPage,
    comparisonByQuestion,
    finalAnswers: navbarContext.finalAnswers,
    setViewMode: navbarContext.setViewMode as (mode: string) => void,
    goToQuestion: navbarContext.goToPage,
    onReset: navbarContext.onReset,
  };

  return <Navbar store={store} usersByPage={navbarContext.usersByPage} />;
}

// ---------------------------------------------------------------------------
// Rendering: Summary wrapper
// ---------------------------------------------------------------------------

function Amstar2SummaryAdapter(
  summaryContext: SummaryContext<Record<string, any>, ComparisonResult | null, Amstar2NavItem>,
) {
  const comparison = summaryContext.comparison;
  const summary = comparison ? getReconciliationSummary(comparison) : null;
  const comparisonByQuestion = buildComparisonByQuestion(comparison);

  return (
    <SummaryView
      questionKeys={summaryContext.navItems.map(item => item.key)}
      finalAnswers={summaryContext.finalAnswers}
      comparisonByQuestion={comparisonByQuestion}
      reconciledName={summaryContext.reconciledName}
      onReconciledNameChange={summaryContext.onReconciledNameChange}
      onGoToQuestion={summaryContext.onGoToPage}
      onSave={summaryContext.onSave}
      onBack={summaryContext.onBack}
      allAnswered={summaryContext.allAnswered}
      saving={summaryContext.saving}
      summary={summary}
    />
  );
}

// ---------------------------------------------------------------------------
// Export adapter
// ---------------------------------------------------------------------------

export const amstar2Adapter: ReconciliationAdapter<
  any,
  Record<string, any>,
  ComparisonResult | null,
  Amstar2NavItem
> = {
  checklistType: 'AMSTAR2',
  title: 'Reconciliation',
  pageCounterLabel: 'Question',
  getPageLabel: (pageIndex: number) => `Question ${pageIndex + 1}`,

  buildNavItems: () => AMSTAR2_NAV_ITEMS,
  deriveFinalAnswers,
  compare,

  hasAnswer,
  isAgreement,

  autoFillFromReviewer1,
  resetAllAnswers,

  renderPage,
  NavbarComponent: Amstar2NavbarAdapter,
  SummaryComponent: Amstar2SummaryAdapter,
};
