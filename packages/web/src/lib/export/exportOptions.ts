export type ExportFormat = 'pdf' | 'csv';
export type ExportDelivery = 'single' | 'perAppraisal' | 'zip';
const DELIVERIES: ExportDelivery[] = ['single', 'perAppraisal', 'zip'];
export type ExportStatusScope = 'finalized' | 'any';

export interface ExportOptions {
  format: ExportFormat;
  status: ExportStatusScope;
  outcomeId: string | null;
  tool: string | null;
  reviewerId: string | null;
  /** Drop reviewer copies wherever a consensus checklist exists for the same cell. */
  consensusOnly: boolean;
  /** PDF only: the signalling question tables under each domain. */
  includeSignallingQuestions: boolean;
  /** Support-for-judgement comments and free-text notes, in both formats. */
  includeNotes: boolean;
  pageSize: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  delivery: ExportDelivery;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'pdf',
  status: 'finalized',
  outcomeId: null,
  tool: null,
  reviewerId: null,
  consensusOnly: true,
  includeSignallingQuestions: true,
  includeNotes: true,
  pageSize: 'a4',
  orientation: 'portrait',
  delivery: 'single',
};

/** Past this many appraisals a single browser tab visibly stalls while building. */
export const EXPORT_WARN_CHECKLISTS = 150;

const storageKey = (projectId: string) => `exportOptions:${projectId}`;

export function loadExportOptions(projectId: string): ExportOptions {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return DEFAULT_EXPORT_OPTIONS;
    const stored = { ...DEFAULT_EXPORT_OPTIONS, ...(JSON.parse(raw) as Partial<ExportOptions>) };
    // A value from an older shape of the dialog must not leave the radios blank
    if (!DELIVERIES.includes(stored.delivery)) stored.delivery = DEFAULT_EXPORT_OPTIONS.delivery;
    return stored;
  } catch {
    return DEFAULT_EXPORT_OPTIONS;
  }
}

export function saveExportOptions(projectId: string, options: ExportOptions): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(options));
  } catch {
    // Private browsing can refuse writes; the dialog just starts from defaults next time
  }
}
