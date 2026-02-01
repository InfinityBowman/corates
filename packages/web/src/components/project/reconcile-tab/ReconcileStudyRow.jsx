/**
 * ReconcileStudyRow - Compact study row for the reconcile tab
 *
 * Displays study info, reconciliation status, and collapsible PDF section.
 * Supports multiple outcomes per study - shows each ready pair as a sub-row.
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { BsFileDiff } from 'solid-icons/bs';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import {
  isReconciledChecklist,
  getReconciliationChecklistsByOutcome,
} from '@/lib/checklist-domain.js';
import { PdfListItem } from '@pdf';
import ReconcileStatusTag from './ReconcileStatusTag.jsx';

/**
 * ReconcileStudyRow - Compact study row for the reconcile tab
 *
 * @param {Object} props
 * @param {Object} props.study - Study object with pdfs and checklists arrays
 * @param {Function} props.onReconcile - (checklist1Id, checklist2Id) => void
 * @param {Function} props.onViewPdf - (pdf) => void
 * @param {Function} props.onDownloadPdf - (pdf) => void
 * @param {Function} props.getAssigneeName - (userId) => string
 * @param {Function} props.getOutcomeName - (outcomeId) => string | null
 * @returns {JSX.Element}
 */
export default function ReconcileStudyRow(props) {
  const [expanded, setExpanded] = createSignal(false);

  const study = () => props.study;

  // Get PDFs sorted: primary first, then protocol, then secondary
  const sortedPdfs = createMemo(() => {
    const pdfs = study().pdfs || [];
    return [...pdfs].sort((a, b) => {
      const tagOrder = { primary: 0, protocol: 1, secondary: 2 };
      const tagA = tagOrder[a.tag] ?? 2;
      const tagB = tagOrder[b.tag] ?? 2;
      if (tagA !== tagB) return tagA - tagB;
      return (b.uploadedAt || 0) - (a.uploadedAt || 0);
    });
  });

  const hasPdfs = () => sortedPdfs().length > 0;
  const pdfCount = () => sortedPdfs().length;

  // Citation line from study or primary PDF
  const citationLine = () => {
    const primaryPdf = sortedPdfs().find(p => p.tag === 'primary') || sortedPdfs()[0];
    const author = primaryPdf?.firstAuthor || study().firstAuthor;
    const year = primaryPdf?.publicationYear || study().publicationYear;
    if (!author && !year) return null;
    return `${author || 'Unknown'}${year ? ` (${year})` : ''}`;
  };

  // Get reconciliation groups by outcome
  const reconciliationGroups = createMemo(() => {
    return getReconciliationChecklistsByOutcome(study());
  });

  // Get groups that are ready (have 2 checklists) and not already finalized
  const readyGroups = createMemo(() => {
    const groups = reconciliationGroups();
    const checklists = study().checklists || [];

    return groups.filter(group => {
      if (group.checklists.length !== 2) return false;

      // Check if there's already a finalized reconciled checklist for this outcome
      const hasFinalized = checklists.some(
        c =>
          isReconciledChecklist(c) &&
          c.status === CHECKLIST_STATUS.FINALIZED &&
          c.type === group.type &&
          c.outcomeId === group.outcomeId,
      );

      return !hasFinalized;
    });
  });

  // Get groups that are waiting (have 1 checklist)
  const waitingGroups = createMemo(() => {
    return reconciliationGroups().filter(g => g.checklists.length === 1);
  });

  // Check if any pair is ready
  const hasReadyPair = () => readyGroups().length > 0;

  // Get the first ready group for simple display
  const firstReadyGroup = () => readyGroups()[0] || null;

  // Check if there are multiple outcomes
  const hasMultipleOutcomes = () => {
    const ready = readyGroups();
    const waiting = waitingGroups();
    return ready.length + waiting.length > 1;
  };

  // Get reviewer name for a checklist
  const getReviewerName = checklist => {
    if (!checklist.assignedTo) return 'Unknown';
    return props.getAssigneeName?.(checklist.assignedTo) || 'Unknown';
  };

  // Get outcome name for a group
  const getOutcomeName = group => {
    if (!group.outcomeId) return null;
    return props.getOutcomeName?.(group.outcomeId) || 'Unknown Outcome';
  };

  // Start reconciliation for a group
  const startReconciliationForGroup = group => {
    if (group.checklists.length === 2) {
      props.onReconcile?.(group.checklists[0].id, group.checklists[1].id);
    }
  };

  // Handle row click - toggle unless clicking on interactive elements or selectable text
  const handleRowClick = e => {
    if (!hasPdfs() && !hasMultipleOutcomes()) return;
    const target = e.target;
    const interactive = target.closest('button, [role="button"], [data-selectable]');
    if (interactive) return;
    setExpanded(!expanded());
  };

  return (
    <div class='border-border bg-card hover:border-border-strong overflow-hidden rounded-lg border transition-colors'>
      <Collapsible open={expanded()}>
        <div
          class={`flex items-center gap-3 px-4 py-3 select-none ${hasPdfs() || hasMultipleOutcomes() ? 'cursor-pointer' : ''}`}
          onClick={handleRowClick}
        >
          {/* Chevron indicator */}
          <Show when={hasPdfs() || hasMultipleOutcomes()}>
            <div class='-ml-1 shrink-0 p-1'>
              <BiRegularChevronRight
                class={`text-muted-foreground/70 h-5 w-5 transition-transform duration-200 ${expanded() ? 'rotate-90' : ''}`}
              />
            </div>
          </Show>

          {/* Study info */}
          <div class='min-w-0 flex-1'>
            <div class='flex items-center gap-2'>
              <span class='text-foreground truncate font-medium'>{study().name}</span>
            </div>
            {/* Citation line - selectable */}
            <Show when={citationLine()}>
              <p
                class='text-muted-foreground w-fit cursor-text truncate text-xs select-text'
                data-selectable
              >
                {citationLine()}
                <Show when={hasPdfs()}>
                  <span class='text-muted-foreground/70'> · {pdfCount()} PDFs</span>
                </Show>
              </p>
            </Show>
            <Show when={!citationLine() && hasPdfs()}>
              <p class='text-muted-foreground/70 text-xs'>{pdfCount()} PDFs</p>
            </Show>
          </div>

          {/* Reconciliation status tag */}
          <ReconcileStatusTag study={study()} getAssigneeName={props.getAssigneeName} />

          {/* Outcome badge (for first ready group) */}
          <Show when={firstReadyGroup()?.outcomeId}>
            <span
              class='bg-secondary text-secondary-foreground inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-medium'
              data-selectable
            >
              {getOutcomeName(firstReadyGroup())}
            </span>
          </Show>

          {/* Multiple outcomes indicator */}
          <Show when={hasMultipleOutcomes()}>
            <span class='text-muted-foreground text-xs'>
              +{readyGroups().length + waitingGroups().length - 1} more
            </span>
          </Show>

          {/* Reviewer info when ready (single outcome mode) */}
          <Show when={hasReadyPair() && !hasMultipleOutcomes()}>
            <div class='text-secondary-foreground flex items-center gap-2 text-sm'>
              <Show when={firstReadyGroup()?.checklists[0]}>
                {checklist => <span>{getReviewerName(checklist())}</span>}
              </Show>
              <span class='text-muted-foreground/70'>vs</span>
              <Show when={firstReadyGroup()?.checklists[1]}>
                {checklist => <span>{getReviewerName(checklist())}</span>}
              </Show>
            </div>
          </Show>

          {/* Reconcile button (single outcome mode) */}
          <Show when={!hasMultipleOutcomes()}>
            <button
              onClick={e => {
                e.stopPropagation();
                if (firstReadyGroup()) {
                  startReconciliationForGroup(firstReadyGroup());
                }
              }}
              disabled={!hasReadyPair()}
              class={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                hasReadyPair() ?
                  'bg-primary hover:bg-primary/90 focus:ring-primary text-white focus:ring-2 focus:outline-none'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
              }`}
            >
              <BsFileDiff class='h-4 w-4' />
              Reconcile
            </button>
          </Show>
        </div>
        <CollapsibleContent>
          {/* Multiple outcome rows */}
          <Show when={hasMultipleOutcomes()}>
            <div class='border-border-subtle space-y-1 border-t px-4 py-3'>
              <For each={readyGroups()}>
                {group => (
                  <div class='bg-muted/50 flex items-center justify-between rounded-lg p-3'>
                    <div class='flex items-center gap-3'>
                      <Show when={group.outcomeId}>
                        <span class='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
                          {getOutcomeName(group)}
                        </span>
                      </Show>
                      <div class='text-secondary-foreground flex items-center gap-2 text-sm'>
                        <span>{getReviewerName(group.checklists[0])}</span>
                        <span class='text-muted-foreground/70'>vs</span>
                        <span>{getReviewerName(group.checklists[1])}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => startReconciliationForGroup(group)}
                      class='bg-primary hover:bg-primary/90 focus:ring-primary flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none'
                    >
                      <BsFileDiff class='h-4 w-4' />
                      Reconcile
                    </button>
                  </div>
                )}
              </For>
              {/* Waiting groups */}
              <For each={waitingGroups()}>
                {group => (
                  <div class='bg-muted/30 flex items-center justify-between rounded-lg p-3'>
                    <div class='flex items-center gap-3'>
                      <Show when={group.outcomeId}>
                        <span class='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
                          {getOutcomeName(group)}
                        </span>
                      </Show>
                      <div class='text-muted-foreground flex items-center gap-2 text-sm'>
                        <span>{getReviewerName(group.checklists[0])}</span>
                        <span class='text-muted-foreground/70'>waiting for second reviewer</span>
                      </div>
                    </div>
                    <span class='bg-secondary text-muted-foreground rounded-lg px-3 py-1.5 text-sm font-medium'>
                      Waiting
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Expanded PDF Section */}
          <Show when={hasPdfs()}>
            <div class='border-border-subtle space-y-2 border-t px-4 py-3'>
              <For each={sortedPdfs()}>
                {pdf => (
                  <PdfListItem
                    pdf={pdf}
                    onView={() => props.onViewPdf?.(pdf)}
                    onDownload={() => props.onDownloadPdf?.(pdf)}
                    readOnly={true}
                  />
                )}
              </For>
            </div>
          </Show>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
