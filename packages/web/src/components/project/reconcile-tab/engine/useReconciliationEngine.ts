/**
 * useReconciliationEngine - Shared state machine for all reconciliation types.
 *
 * Owns: navigation (currentPage, viewMode, expandedDomain), localStorage
 * persistence, auto-fill logic, save flow, summary stats.
 *
 * Delegates all type-specific behavior to the ReconciliationAdapter.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { showToast } from '@/components/ui/toast';
import type {
  ErasedAdapter,
  ReconciliationNavItem,
  ReconciliationSummaryStats,
} from './types';
import type { TextRef } from '@/primitives/useProject/checklists';

interface UseReconciliationEngineOptions {
  adapter: ErasedAdapter;
  checklist1: unknown;
  checklist2: unknown;
  reconciledChecklist: unknown;
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void;
  setTextValue: (ref: TextRef, text: string) => void;
  onSaveReconciled: (name?: string) => void;
  checklist1Id: string | null;
  checklist2Id: string | null;
}

interface UseReconciliationEngineResult {
  // Navigation
  currentPage: number;
  viewMode: 'questions' | 'summary';
  expandedDomain: string | null;
  setExpandedDomain: (domain: string | null) => void;
  goToPage: (index: number) => void;
  goToNext: () => void;
  goToPrevious: () => void;
  setViewMode: (mode: 'questions' | 'summary') => void;

  // Derived state
  navItems: ReconciliationNavItem[];
  finalAnswers: unknown;
  comparison: unknown;
  allAnswered: boolean;
  answeredCount: number;
  summaryStats: ReconciliationSummaryStats;
  currentItem: ReconciliationNavItem | null;
  currentIsAgreement: boolean;

  // Save flow
  saving: boolean;
  finishDialogOpen: boolean;
  setFinishDialogOpen: (open: boolean) => void;
  handleSave: () => void;
  confirmSave: () => Promise<void>;
  reconciledName: string;
  setReconciledName: (name: string) => void;

  // Reset
  handleReset: () => void;
}

export function useReconciliationEngine({
  adapter,
  checklist1,
  checklist2,
  reconciledChecklist,
  updateChecklistAnswer,
  setTextValue,
  onSaveReconciled,
  checklist1Id,
  checklist2Id,
}: UseReconciliationEngineOptions): UseReconciliationEngineResult {
  // -----------------------------------------------------------------------
  // Navigation state
  // -----------------------------------------------------------------------

  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewModeRaw] = useState<'questions' | 'summary'>('questions');
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  // Save flow state
  const [saving, setSaving] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [reconciledName, setReconciledName] = useState('Reconciled Checklist');

  // Guard for one-time localStorage initialization
  const initializedRef = useRef(false);

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  const storageKey = useMemo(() => {
    if (!checklist1Id || !checklist2Id) return null;
    return `recon-nav-${adapter.checklistType}-${checklist1Id}-${checklist2Id}`;
  }, [adapter.checklistType, checklist1Id, checklist2Id]);

  // Load on mount (once)
  useEffect(() => {
    if (initializedRef.current || !storageKey) return;
    initializedRef.current = true;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.currentPage === 'number') setCurrentPage(parsed.currentPage);
        if (parsed.viewMode === 'questions' || parsed.viewMode === 'summary')
          setViewModeRaw(parsed.viewMode);
      }
    } catch {
      // Silently ignore corrupted storage
    }
  }, [storageKey]);

  // Save when nav state changes
  useEffect(() => {
    if (!storageKey || !initializedRef.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ currentPage, viewMode }));
    } catch {
      // Storage full or unavailable
    }
  }, [currentPage, viewMode, storageKey]);

  // -----------------------------------------------------------------------
  // Adapter-derived state
  // -----------------------------------------------------------------------

  const navItems = useMemo(
    () => adapter.buildNavItems(reconciledChecklist),
    [adapter, reconciledChecklist],
  );

  const totalPages = navItems.length;

  const finalAnswers = useMemo(
    () => adapter.deriveFinalAnswers(reconciledChecklist),
    [adapter, reconciledChecklist],
  );

  const comparison = useMemo(
    () => adapter.compare(checklist1, checklist2, reconciledChecklist),
    [adapter, checklist1, checklist2, reconciledChecklist],
  );

  // -----------------------------------------------------------------------
  // Answer stats
  // -----------------------------------------------------------------------

  const allAnswered = useMemo(
    () => navItems.every(item => adapter.hasAnswer(item, finalAnswers)),
    [adapter, navItems, finalAnswers],
  );

  const answeredCount = useMemo(
    () => navItems.filter(item => adapter.hasAnswer(item, finalAnswers)).length,
    [adapter, navItems, finalAnswers],
  );

  const summaryStats: ReconciliationSummaryStats = useMemo(() => {
    let agreed = 0;
    let disagreed = 0;
    for (const item of navItems) {
      if (adapter.isAgreement(item, comparison)) {
        agreed++;
      } else {
        disagreed++;
      }
    }
    const total = navItems.length;
    return {
      total,
      agreed,
      disagreed,
      agreementPercentage: total > 0 ? Math.round((agreed / total) * 100) : 0,
      answered: answeredCount,
    };
  }, [adapter, navItems, comparison, answeredCount]);

  // -----------------------------------------------------------------------
  // Current item
  // -----------------------------------------------------------------------

  const currentItem = navItems[currentPage] ?? null;

  const currentIsAgreement = useMemo(
    () => (currentItem ? adapter.isAgreement(currentItem, comparison) : true),
    [adapter, currentItem, comparison],
  );

  // -----------------------------------------------------------------------
  // Clamp page when navItems change (e.g. ROB2 aim change alters domain list)
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (totalPages === 0) return;
    const clamped = Math.max(0, Math.min(currentPage, totalPages - 1));
    if (clamped !== currentPage) {
      setCurrentPage(clamped);
    }
  }, [totalPages, currentPage]);

  // -----------------------------------------------------------------------
  // Auto-expand domain on mount (only when expandedDomain has never been set)
  // -----------------------------------------------------------------------

  const hasAutoExpandedRef = useRef(false);

  useEffect(() => {
    if (hasAutoExpandedRef.current) return;
    if (navItems.length > 0) {
      const item = navItems[currentPage];
      if (item?.sectionKey) {
        setExpandedDomain(item.sectionKey);
        hasAutoExpandedRef.current = true;
      }
    }
  }, [navItems, currentPage]);

  // -----------------------------------------------------------------------
  // Navigation functions
  // -----------------------------------------------------------------------

  const setViewMode = useCallback((mode: 'questions' | 'summary') => {
    setViewModeRaw(mode);
  }, []);

  const goToPage = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, totalPages - 1));
      setCurrentPage(clamped);
      setViewModeRaw('questions');

      // Auto-expand domain for the target page
      const item = navItems[clamped];
      if (item?.sectionKey) {
        setExpandedDomain(item.sectionKey);
      }
    },
    [navItems, totalPages],
  );

  const goToNext = useCallback(() => {
    const item = navItems[currentPage];
    if (!item) return;

    // Auto-fill from reviewer1 if item is unanswered and reviewers agree
    const hasAns = adapter.hasAnswer(item, finalAnswers);
    const isAgree = adapter.isAgreement(item, comparison);
    if (!hasAns && isAgree) {
      adapter.autoFillFromReviewer1(item, checklist1, updateChecklistAnswer, setTextValue);
    }

    if (currentPage < totalPages - 1) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);

      // Auto-expand domain for next page
      const nextItem = navItems[nextPage];
      if (nextItem?.sectionKey && nextItem.sectionKey !== expandedDomain) {
        setExpandedDomain(nextItem.sectionKey);
      }
    } else {
      setViewModeRaw('summary');
    }

    // Run adapter-specific post-navigation side effects (ROB2 auto-NA)
    adapter.onAfterNavigate?.(navItems, finalAnswers, updateChecklistAnswer);
  }, [
    adapter,
    navItems,
    currentPage,
    totalPages,
    finalAnswers,
    comparison,
    checklist1,
    updateChecklistAnswer,
    setTextValue,
    expandedDomain,
  ]);

  const goToPrevious = useCallback(() => {
    if (viewMode === 'summary') {
      setViewModeRaw('questions');
      return;
    }
    if (currentPage > 0) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);

      // Auto-expand domain for previous page
      const prevItem = navItems[prevPage];
      if (prevItem?.sectionKey && prevItem.sectionKey !== expandedDomain) {
        setExpandedDomain(prevItem.sectionKey);
      }
    }
  }, [viewMode, currentPage, navItems, expandedDomain]);

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const handleReset = useCallback(() => {
    adapter.resetAllAnswers(updateChecklistAnswer);
    setCurrentPage(0);
    setViewModeRaw('questions');
    setExpandedDomain(null);
    showToast.info('Reconciliation Reset', 'All reconciliations have been cleared.');
  }, [adapter, updateChecklistAnswer]);

  // -----------------------------------------------------------------------
  // Save flow
  // -----------------------------------------------------------------------

  const handleSave = useCallback(() => {
    if (!allAnswered) {
      showToast.error(
        'Incomplete Review',
        `Please review all ${adapter.pageCounterLabel.toLowerCase()}s before saving.`,
      );
      return;
    }
    setFinishDialogOpen(true);
  }, [allAnswered, adapter.pageCounterLabel]);

  const confirmSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSaveReconciled(reconciledName);
      setFinishDialogOpen(false);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Save Failed' });
    } finally {
      setSaving(false);
    }
  }, [onSaveReconciled, reconciledName]);

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    // Navigation
    currentPage,
    viewMode,
    expandedDomain,
    setExpandedDomain,
    goToPage,
    goToNext,
    goToPrevious,
    setViewMode,

    // Derived state
    navItems,
    finalAnswers,
    comparison,
    allAnswered,
    answeredCount,
    summaryStats,
    currentItem,
    currentIsAgreement,

    // Save flow
    saving,
    finishDialogOpen,
    setFinishDialogOpen,
    handleSave,
    confirmSave,
    reconciledName,
    setReconciledName,

    // Reset
    handleReset,
  };
}
