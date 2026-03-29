import type { ReactNode } from 'react';
import type { getUserColor } from '@/lib/userColors.js';

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
export interface EngineContext {
  currentItem: ReconciliationNavItem;
  navItems: ReconciliationNavItem[];
  checklist1: unknown;
  checklist2: unknown;
  /** Derived via adapter.deriveFinalAnswers */
  finalAnswers: unknown;
  /** From adapter.compare */
  comparison: unknown;
  reviewer1Name: string;
  reviewer2Name: string;
  /** Pre-computed by engine via adapter.isAgreement for current item */
  isAgreement: boolean;
  /** Raw Yjs write callback - adapter formats args for its data model */
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void;
  /** Raw Y.Text accessor - adapter calls with type-specific arg pattern */
  getTextRef: ((...args: unknown[]) => unknown) | null;
  /** Set a Y.Text field value by key path (equality-checked, transacted) */
  setTextValue:
    | ((
        params: { sectionKey?: string; fieldKey?: string; questionKey?: string },
        text: string,
      ) => void)
    | null;
}

/**
 * Passed to adapter.NavbarComponent.
 * The engine provides all navigation state; the navbar renders type-specific UI.
 */
export interface NavbarContext {
  navItems: ReconciliationNavItem[];
  currentPage: number;
  viewMode: 'questions' | 'summary';
  finalAnswers: unknown;
  comparison: unknown;
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
export interface SummaryContext {
  navItems: ReconciliationNavItem[];
  finalAnswers: unknown;
  comparison: unknown;
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
// Adapter interface
// ---------------------------------------------------------------------------

/**
 * The contract each checklist type implements. Contains all type-specific
 * behavior: data derivation, answer checking, write operations, and rendering.
 * Registered in the CHECKLIST_REGISTRY under a `reconciliation` key.
 */
export interface ReconciliationAdapter {
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
  buildNavItems: (reconciledChecklist: unknown) => ReconciliationNavItem[];

  /**
   * Derive the finalAnswers object from reconciledChecklist.
   * AMSTAR2: filters by questionKeys, groups multi-part questions.
   * ROB2/ROBINS-I: returns reconciledChecklist || {} (direct pass-through).
   */
  deriveFinalAnswers: (reconciledChecklist: unknown) => unknown;

  /**
   * Run the type-specific comparison algorithm.
   * The engine stores the result and passes it to isAgreement, renderPage,
   * NavbarComponent, and SummaryComponent.
   */
  compare: (checklist1: unknown, checklist2: unknown, reconciledChecklist: unknown) => unknown;

  // --- Answer checking (pure functions) ---

  /** Whether this nav item has a committed final answer */
  hasAnswer: (item: ReconciliationNavItem, finalAnswers: unknown) => boolean;

  /** Whether reviewers agreed on this nav item */
  isAgreement: (item: ReconciliationNavItem, comparison: unknown) => boolean;

  // --- Write operations ---

  /**
   * Copy reviewer1's answer for this item into the reconciled checklist.
   * For ROB2/ROBINS-I, also copies comment text via setTextValue.
   */
  autoFillFromReviewer1: (
    item: ReconciliationNavItem,
    checklist1: unknown,
    updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
    getTextRef: ((...args: unknown[]) => unknown) | null,
    setTextValue?:
      | ((
          params: { sectionKey?: string; fieldKey?: string; questionKey?: string },
          text: string,
        ) => void)
      | null,
  ) => void;

  /** Reset all answers to empty/default state */
  resetAllAnswers: (updateChecklistAnswer: (sectionKey: string, data: unknown) => void) => void;

  /**
   * Optional: called after each navigation step.
   * ROB2 uses this to auto-set NA for skipped questions.
   * ROBINS-I will use this when scoring-based skip detection is added.
   */
  onAfterNavigate?: (
    navItems: ReconciliationNavItem[],
    finalAnswers: unknown,
    updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
  ) => void;

  // --- Rendering ---

  /**
   * Render the question/item page for the current nav item.
   * The adapter slices reviewer data from raw checklists, builds write
   * callbacks, and composes the existing page components.
   */
  renderPage: (context: EngineContext) => ReactNode;

  /**
   * Type-specific navbar component.
   * AMSTAR2: flat question pills. ROB2/ROBINS-I: grouped domain pills.
   */
  NavbarComponent: React.ComponentType<NavbarContext>;

  /**
   * Type-specific summary view.
   * AMSTAR2's includes a reconciledName input field.
   */
  SummaryComponent: React.ComponentType<SummaryContext>;

  /**
   * Optional: warning banner above the page content.
   * ROB2: aim mismatch warning. ROBINS-I: section B critical risk.
   */
  renderWarningBanner?: (
    checklist1: unknown,
    checklist2: unknown,
    reconciledChecklist: unknown,
  ) => ReactNode | null;
}

// ---------------------------------------------------------------------------
// Engine component props
// ---------------------------------------------------------------------------

export interface ReconciliationEngineProps {
  checklistType: string;
  checklist1: unknown;
  checklist2: unknown;
  reconciledChecklist: unknown;
  reconciledChecklistId: string | null;
  reviewer1Name: string;
  reviewer2Name: string;
  onSaveReconciled: (name?: string) => void;
  onCancel: () => void;
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void;
  getTextRef: ((...args: unknown[]) => unknown) | null;
  setTextValue:
    | ((
        params: { sectionKey?: string; fieldKey?: string; questionKey?: string },
        text: string,
      ) => void)
    | null;

  // PDF
  pdfData: ArrayBuffer | null;
  pdfFileName: string | null;
  pdfUrl: string | null;
  pdfLoading: boolean;
  pdfs: unknown[];
  selectedPdfId: string | null;
  onPdfSelect: (pdfId: string) => void;

  // Presence
  getAwareness?: () => unknown;
  currentUser: PresenceUser | null;
}
