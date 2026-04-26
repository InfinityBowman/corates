import type { ReactNode } from 'react';
import type * as Y from 'yjs';
import type { getUserColor } from '@/lib/userColors.js';
import type { TextRef } from '@/primitives/useProject/checklists';
import type { PdfEntry } from '@/stores/projectStore';

// ---------------------------------------------------------------------------
// Presence types (mirrored from useReconciliationPresence to avoid
// importing the hook's internals into the adapter contract)
// ---------------------------------------------------------------------------

export interface PresenceUser {
  id: string;
  name: string;
  image?: string | null;
}

export interface RemoteUser {
  clientId: number;
  userId: string;
  name: string;
  image: string | null;
  currentPage: number;
  cursor: { x: number; y: number; scrollY: number; timestamp: number } | null;
  color: ReturnType<typeof getUserColor>;
}

// ---------------------------------------------------------------------------
// Navigation item model
// ---------------------------------------------------------------------------

/**
 * Unified navigation item. All three checklist types reduce to this shape.
 * The engine iterates over these; the adapter interprets them.
 */
export interface ReconciliationNavItem {
  /** Unique key within the checklist (e.g. "q1", "d1_q1", "overall_direction") */
  key: string;
  /** Display label for pills and summary rows ("1", "D2", "B3") */
  label: string;
  /** Grouping section display name for summary headers */
  section: string;
  /** Stable section key for expand/collapse tracking (e.g. "preliminary", "domain1", "overall") */
  sectionKey: string;
  /** Opaque to the engine, interpreted by the adapter (e.g. "preliminary", "domainQuestion") */
  type: string;
  /** ROB2/ROBINS-I domain identifier */
  domainKey?: string;
  /** Arbitrary adapter-defined payload (question def, field def, etc.) */
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Context types passed to adapter render methods
// ---------------------------------------------------------------------------

/**
 * Passed to adapter.renderPage() for the current navigation item.
 * The adapter uses these raw materials to slice reviewer data,
 * build write callbacks, and compose existing page components.
 */
export interface EngineContext<
  TChecklist,
  TFinalAnswers,
  TComparison,
  TNavItem extends ReconciliationNavItem = ReconciliationNavItem,
> {
  currentItem: TNavItem;
  navItems: TNavItem[];
  checklist1: TChecklist | null;
  checklist2: TChecklist | null;
  /** Derived via adapter.deriveFinalAnswers */
  finalAnswers: TFinalAnswers;
  /** From adapter.compare */
  comparison: TComparison;
  reviewer1Name: string;
  reviewer2Name: string;
  /** Pre-computed by engine via adapter.isAgreement for current item */
  isAgreement: boolean;
  /** Raw Yjs write callback - adapter formats args for its data model */
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void;
  /** Y.Text accessor for collaborative comment/note fields */
  getTextRef: (ref: TextRef) => Y.Text | null;
  /** Set a Y.Text field value (equality-checked, transacted) */
  setTextValue: (ref: TextRef, text: string) => void;
}

/**
 * Passed to adapter.NavbarComponent.
 * The engine provides all navigation state; the navbar renders type-specific UI.
 */
export interface NavbarContext<
  TFinalAnswers,
  TComparison,
  TNavItem extends ReconciliationNavItem = ReconciliationNavItem,
> {
  navItems: TNavItem[];
  currentPage: number;
  viewMode: 'questions' | 'summary';
  finalAnswers: TFinalAnswers;
  comparison: TComparison;
  /** Per-page presence: Map<pageIndex, RemoteUser[]> */
  usersByPage: Map<number, RemoteUser[]>;

  // Navigation callbacks
  goToPage: (index: number) => void;
  setViewMode: (mode: 'questions' | 'summary') => void;
  onReset: () => void;

  // Domain expansion (ROB2/ROBINS-I use these; AMSTAR2 ignores them)
  expandedDomain: string | null;
  setExpandedDomain: (domain: string | null) => void;
}

/**
 * Passed to adapter.SummaryComponent.
 */
export interface SummaryContext<
  TFinalAnswers,
  TComparison,
  TNavItem extends ReconciliationNavItem = ReconciliationNavItem,
> {
  navItems: TNavItem[];
  finalAnswers: TFinalAnswers;
  comparison: TComparison;
  summaryStats: ReconciliationSummaryStats;
  allAnswered: boolean;
  saving: boolean;
  onGoToPage: (index: number) => void;
  onSave: () => void;
  onBack: () => void;
  /** AMSTAR2 renders an input for this; ROB2/ROBINS-I ignore it */
  reconciledName: string;
  onReconciledNameChange: (name: string) => void;
}

export interface ReconciliationSummaryStats {
  total: number;
  agreed: number;
  disagreed: number;
  agreementPercentage: number;
  answered: number;
}

// ---------------------------------------------------------------------------
// Supported checklist types
// ---------------------------------------------------------------------------

export type SupportedChecklistType = 'AMSTAR2' | 'ROB2' | 'ROBINS_I';

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

/**
 * The contract each checklist type implements. Contains all type-specific
 * behavior: data derivation, answer checking, write operations, and rendering.
 * Registered in the CHECKLIST_REGISTRY under a `reconciliation` key.
 */
export interface ReconciliationAdapter<
  TChecklist,
  TFinalAnswers = TChecklist,
  TComparison = unknown,
  TNavItem extends ReconciliationNavItem = ReconciliationNavItem,
> {
  // --- Identity ---

  checklistType: string;
  /** Header title (e.g. "Reconciliation", "ROB-2 Reconciliation") */
  title: string;
  /** Counter label (e.g. "Question" vs "Item") */
  pageCounterLabel: string;
  /** Presence tooltip label (e.g. "Question 3" vs "Item 3") */
  getPageLabel: (pageIndex: number) => string;

  // --- Data derivation ---

  /**
   * Build the flat navigation item array from reconciledChecklist state.
   * ROB2: reads preliminary.aim to determine active domains.
   * ROBINS-I: reads sectionC.isPerProtocol to determine domain 1A/1B.
   * AMSTAR2: static list from getQuestionKeys().
   */
  buildNavItems: (reconciledChecklist: TChecklist | null) => TNavItem[];

  /**
   * Derive the finalAnswers object from reconciledChecklist.
   * AMSTAR2: filters by questionKeys, groups multi-part questions.
   * ROB2/ROBINS-I: returns reconciledChecklist || {} (direct pass-through).
   */
  deriveFinalAnswers: (reconciledChecklist: TChecklist | null) => TFinalAnswers;

  /**
   * Run the type-specific comparison algorithm.
   * The engine stores the result and passes it to isAgreement, renderPage,
   * NavbarComponent, and SummaryComponent.
   */
  compare: (
    checklist1: TChecklist | null,
    checklist2: TChecklist | null,
    reconciledChecklist: TChecklist | null,
  ) => TComparison;

  // --- Answer checking (pure functions) ---

  /** Whether this nav item has a committed final answer */
  hasAnswer: (item: TNavItem, finalAnswers: TFinalAnswers) => boolean;

  /** Whether reviewers agreed on this nav item */
  isAgreement: (item: TNavItem, comparison: TComparison) => boolean;

  // --- Write operations ---

  /**
   * Copy reviewer1's answer for this item into the reconciled checklist.
   * For ROB2/ROBINS-I, also copies comment text via setTextValue.
   */
  autoFillFromReviewer1: (
    item: TNavItem,
    checklist1: TChecklist | null,
    updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
    setTextValue: (ref: TextRef, text: string) => void,
  ) => void;

  /** Reset all answers to empty/default state */
  resetAllAnswers: (updateChecklistAnswer: (sectionKey: string, data: unknown) => void) => void;

  /**
   * Optional: called after each navigation step.
   * ROB2 uses this to auto-set NA for skipped questions.
   * ROBINS-I will use this when scoring-based skip detection is added.
   */
  onAfterNavigate?: (
    navItems: TNavItem[],
    finalAnswers: TFinalAnswers,
    updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
  ) => void;

  // --- Rendering ---

  /**
   * Render the question/item page for the current nav item.
   * The adapter slices reviewer data from raw checklists, builds write
   * callbacks, and composes the existing page components.
   */
  renderPage: (
    context: EngineContext<TChecklist, TFinalAnswers, TComparison, TNavItem>,
  ) => ReactNode;

  /**
   * Type-specific navbar component.
   * AMSTAR2: flat question pills. ROB2/ROBINS-I: grouped domain pills.
   */
  NavbarComponent: React.ComponentType<NavbarContext<TFinalAnswers, TComparison, TNavItem>>;

  /**
   * Type-specific summary view.
   * AMSTAR2's includes a reconciledName input field.
   */
  SummaryComponent: React.ComponentType<SummaryContext<TFinalAnswers, TComparison, TNavItem>>;

  /**
   * Optional: warning banner above the page content.
   * ROB2: aim mismatch warning. ROBINS-I: section B critical risk.
   */
  renderWarningBanner?: (
    checklist1: TChecklist | null,
    checklist2: TChecklist | null,
    reconciledChecklist: TChecklist | null,
  ) => ReactNode | null;
}

// ---------------------------------------------------------------------------
// Type-erased adapter
// ---------------------------------------------------------------------------

/**
 * Type-erased adapter used by the engine core. Each adapter is fully typed
 * internally (see amstar2/adapter.tsx, rob2/adapter.tsx, robins-i/adapter.tsx),
 * but the engine needs to hold any of them without knowing which one.
 * TypeScript lacks existential types, so this boundary uses type erasure.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ErasedAdapter = ReconciliationAdapter<any, any, any, any>;

// ---------------------------------------------------------------------------
// Engine component props
// ---------------------------------------------------------------------------

export interface ReconciliationEngineProps {
  checklistType: SupportedChecklistType;
  checklist1: unknown;
  checklist2: unknown;
  reconciledChecklist: unknown;
  reconciledChecklistId: string | null;
  reviewer1Name: string;
  reviewer2Name: string;
  onSaveReconciled: (name?: string) => void;
  onCancel: () => void;
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void;
  getTextRef: (ref: TextRef) => Y.Text | null;
  setTextValue: (ref: TextRef, text: string) => void;

  // PDF
  pdfData: ArrayBuffer | null;
  pdfFileName: string | null;
  pdfUrl: string | null;
  pdfLoading: boolean;
  pdfs: PdfEntry[];
  selectedPdfId: string | null;
  onPdfSelect: (pdfId: string) => void;

  // Presence
  getAwareness?: () => unknown;
  currentUser: PresenceUser | null;
}
