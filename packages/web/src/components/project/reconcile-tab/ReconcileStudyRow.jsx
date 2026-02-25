/**
 * ReconcileStudyRow - Study row for the reconcile tab
 *
 * Displays study info with stacked outcome sub-rows (always visible).
 * Multi-outcome studies show READY/WAITING section headers.
 * Single-outcome studies show inline reconcile controls.
 * PDFs are expandable via chevron.
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { BsFileDiff } from 'solid-icons/bs';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import { getChecklistMetadata } from '@/checklist-registry';
import {
  isReconciledChecklist,
  getReconciliationChecklistsByOutcome,
} from '@/lib/checklist-domain.js';
import { PdfListItem } from '@pdf';
import ReconcileStatusTag from './ReconcileStatusTag.jsx';

export default function ReconcileStudyRow(props) {
  // props.study, props.onReconcile, props.onViewPdf, props.onDownloadPdf,
  // props.getAssigneeName, props.getOutcomeName

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

  const hasReadyPair = () => readyGroups().length > 0;
  const firstReadyGroup = () => readyGroups()[0] || null;

  const hasMultipleOutcomes = () => {
    return readyGroups().length + waitingGroups().length > 1;
  };

  const getReviewerName = checklist => {
    if (!checklist.assignedTo) return 'Unknown';
    return props.getAssigneeName?.(checklist.assignedTo) || 'Unknown';
  };

  const getOutcomeName = group => {
    if (!group.outcomeId) return null;
    return props.getOutcomeName?.(group.outcomeId) || 'Unknown Outcome';
  };

  const startReconciliationForGroup = group => {
    if (group.checklists.length === 2) {
      props.onReconcile?.(group.checklists[0].id, group.checklists[1].id);
    }
  };

  // Handle row click -- only for PDF expansion
  const handleRowClick = e => {
    if (!hasPdfs()) return;
    const target = e.target;
    const interactive = target.closest('button, [role="button"], [data-selectable]');
    if (interactive) return;
    setExpanded(!expanded());
  };

  return (
    <div class='border-border bg-card hover:border-border-strong overflow-hidden rounded-lg border transition-colors'>
      <Collapsible open={expanded()}>
        {/* Study header */}
        <div
          class={`flex flex-wrap items-center gap-3 px-4 py-3 select-none ${hasPdfs() ? 'cursor-pointer' : ''}`}
          onClick={handleRowClick}
        >
          {/* Chevron for PDFs */}
          <Show when={hasPdfs()}>
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

          {/* Single outcome: inline controls */}
          <Show when={!hasMultipleOutcomes()}>
            <ReconcileStatusTag study={study()} getAssigneeName={props.getAssigneeName} />

            <Show when={firstReadyGroup()?.outcomeId}>
              <span
                class='bg-secondary text-secondary-foreground inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium'
                data-selectable
              >
                {getOutcomeName(firstReadyGroup())}
              </span>
            </Show>

            <Show when={hasReadyPair()}>
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

          {/* Multi-outcome: summary count badges in header */}
          <Show when={hasMultipleOutcomes()}>
            <div class='flex items-center gap-1.5'>
              <Show when={readyGroups().length > 0}>
                <span class='rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'>
                  {readyGroups().length} ready
                </span>
              </Show>
              <Show when={waitingGroups().length > 0}>
                <span class='rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800'>
                  {waitingGroups().length} waiting
                </span>
              </Show>
            </div>
          </Show>
        </div>

        {/* Multi-outcome: stacked sub-rows with section headers (always visible) */}
        <Show when={hasMultipleOutcomes()}>
          <div class='px-4 py-3'>
            {/* READY section */}
            <Show when={readyGroups().length > 0}>
              <div class='mb-2 flex items-center gap-2'>
                <span class='text-xs font-semibold tracking-wide text-green-700'>READY</span>
                <span class='text-xs text-green-600'>({readyGroups().length})</span>
                <div class='h-px flex-1 bg-green-200' />
              </div>
              <div class='space-y-1'>
                <For each={readyGroups()}>
                  {group => (
                    <div class='flex items-center justify-between rounded-lg border border-green-200 bg-green-50/50 p-3'>
                      <div class='flex flex-wrap items-center gap-2'>
                        <span class='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
                          {getChecklistMetadata(group.type)?.name || group.type}
                        </span>
                        <Show when={group.outcomeId}>
                          <span class='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
                            {getOutcomeName(group)}
                          </span>
                        </Show>
                        <span class='text-secondary-foreground text-sm'>
                          {getReviewerName(group.checklists[0])}{' '}
                          <span class='text-muted-foreground/70'>vs</span>{' '}
                          {getReviewerName(group.checklists[1])}
                        </span>
                      </div>
                      <button
                        onClick={() => startReconciliationForGroup(group)}
                        class='bg-primary hover:bg-primary/90 focus:ring-primary flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none'
                      >
                        <BsFileDiff class='h-4 w-4' />
                        Reconcile
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* WAITING section */}
            <Show when={waitingGroups().length > 0}>
              <div class={`mb-1 flex items-center gap-2 ${readyGroups().length > 0 ? 'mt-3' : ''}`}>
                <span class='text-xs font-semibold tracking-wide text-yellow-700'>WAITING</span>
                <span class='text-xs text-yellow-600'>({waitingGroups().length})</span>
                <div class='h-px flex-1 bg-yellow-200' />
              </div>
              <div class='space-y-1'>
                <For each={waitingGroups()}>
                  {group => (
                    <div class='flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/30 p-3'>
                      <div class='flex flex-wrap items-center gap-2'>
                        <span class='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
                          {getChecklistMetadata(group.type)?.name || group.type}
                        </span>
                        <Show when={group.outcomeId}>
                          <span class='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
                            {getOutcomeName(group)}
                          </span>
                        </Show>
                        <span class='text-muted-foreground text-sm'>
                          {getReviewerName(group.checklists[0])} -- waiting for second reviewer
                        </span>
                      </div>
                      <span class='bg-secondary text-muted-foreground shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium'>
                        Waiting
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        {/* Expandable PDF Section */}
        <CollapsibleContent>
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
