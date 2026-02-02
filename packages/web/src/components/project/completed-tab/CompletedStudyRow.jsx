/**
 * CompletedStudyRow - Compact study row for the completed tab
 *
 * Displays study info, completed checklist(s), collapsible PDF section, and
 * button to view previous reviewer checklists (for dual-reviewer studies).
 * Supports multiple outcomes - shows expandable sections when multiple outcomes exist.
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { getChecklistMetadata } from '@/checklist-registry';
import { PdfListItem } from '@pdf';
import { getCompletedChecklistsByOutcome } from '@/lib/checklist-domain.js';
import { getStatusLabel, getStatusStyle } from '@/constants/checklist-status.js';
import PreviousReviewersView from './PreviousReviewersView.jsx';
import CompletedOutcomeRow from './CompletedOutcomeRow.jsx';

export default function CompletedStudyRow(props) {
  // props.study: Study object with pdfs and checklists arrays
  // props.onOpenChecklist: (checklistId) => void
  // props.onViewPdf: (pdf) => void
  // props.onDownloadPdf: (pdf) => void
  // props.getReconciliationProgress: (outcomeId, type) => Object | null
  // props.getAssigneeName: (userId) => string
  // props.getOutcomeName: (outcomeId) => string | null

  const [expanded, setExpanded] = createSignal(false);
  const [showPreviousReviewers, setShowPreviousReviewers] = createSignal(false);

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

  // Group completed checklists by outcome
  const completedOutcomeGroups = createMemo(() => {
    return getCompletedChecklistsByOutcome(study());
  });

  // Check if there are multiple outcomes
  const hasMultipleOutcomes = () => completedOutcomeGroups().length > 1;

  // Get the first group for compact display
  const firstGroup = () => completedOutcomeGroups()[0];

  // Check if we have previous reviewers to show (for first group in single-outcome mode)
  const hasPreviousReviewers = () => {
    const group = firstGroup();
    if (!group) return false;
    const progress = props.getReconciliationProgress?.(group.outcomeId, group.type);
    return !!(progress?.checklist1Id && progress?.checklist2Id);
  };

  // Determine if row should be expandable (has PDFs or multiple outcomes)
  const isExpandable = () => hasPdfs() || hasMultipleOutcomes();

  // Handle row click - toggle unless clicking on interactive elements or selectable text
  const handleRowClick = e => {
    if (!isExpandable()) return;
    const target = e.target;
    const interactive = target.closest('button, [role="button"], [data-selectable]');
    if (interactive) return;
    setExpanded(!expanded());
  };

  return (
    <>
      <div class='border-border bg-card hover:border-border-strong overflow-hidden rounded-lg border transition-colors'>
        <Collapsible open={expanded()}>
          <div
            class={`flex items-center gap-3 px-4 py-3 select-none ${isExpandable() ? 'cursor-pointer' : ''}`}
            onClick={handleRowClick}
          >
            {/* Chevron indicator (only if expandable) */}
            <Show when={isExpandable()}>
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
                  <Show when={hasMultipleOutcomes()}>
                    <span class='text-muted-foreground/70'>
                      {' '}
                      · {completedOutcomeGroups().length} outcomes
                    </span>
                  </Show>
                </p>
              </Show>
              <Show when={!citationLine() && (hasPdfs() || hasMultipleOutcomes())}>
                <p class='text-muted-foreground/70 text-xs'>
                  <Show when={hasPdfs()}>{pdfCount()} PDFs</Show>
                  <Show when={hasPdfs() && hasMultipleOutcomes()}> · </Show>
                  <Show when={hasMultipleOutcomes()}>
                    {completedOutcomeGroups().length} outcomes
                  </Show>
                </p>
              </Show>
            </div>

            {/* First outcome badge (if has outcomeId) */}
            <Show when={firstGroup()?.outcomeId}>
              <span
                class='bg-secondary text-secondary-foreground inline-flex shrink-0 cursor-text items-center rounded-full px-2 py-1 text-xs font-medium select-text'
                data-selectable
              >
                {props.getOutcomeName?.(firstGroup().outcomeId) || 'Unknown Outcome'}
              </span>
            </Show>

            {/* Multiple outcomes indicator */}
            <Show when={hasMultipleOutcomes()}>
              <span class='text-muted-foreground text-xs'>
                +{completedOutcomeGroups().length - 1} more
              </span>
            </Show>

            {/* Checklist type badge - selectable */}
            <Show when={firstGroup()}>
              <span
                class='bg-secondary text-secondary-foreground inline-flex shrink-0 cursor-text items-center rounded-full px-2 py-1 text-xs font-medium select-text'
                data-selectable
              >
                {getChecklistMetadata(firstGroup()?.type)?.name || 'Checklist'}
              </span>
            </Show>

            {/* Checklist status badge (single outcome mode) */}
            <Show when={!hasMultipleOutcomes() && firstGroup()}>
              <span
                class={`inline-flex shrink-0 cursor-text items-center rounded-full px-2.5 py-1 text-xs font-medium select-text ${getStatusStyle(firstGroup()?.checklists[0]?.status)}`}
                data-selectable
              >
                {getStatusLabel(firstGroup()?.checklists[0]?.status)}
              </span>
            </Show>

            {/* View Previous Reviewers button (single outcome mode, for dual-reviewer studies) */}
            <Show when={!hasMultipleOutcomes() && hasPreviousReviewers()}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowPreviousReviewers(true);
                }}
                class='bg-secondary text-secondary-foreground hover:bg-secondary/80 shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors'
              >
                View Previous
              </button>
            </Show>

            {/* Open checklist button (single outcome mode) */}
            <Show when={!hasMultipleOutcomes() && firstGroup()}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  props.onOpenChecklist?.(firstGroup().checklists[0].id);
                }}
                class='bg-primary hover:bg-primary/90 focus:ring-primary shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none'
              >
                Open
              </button>
            </Show>
          </div>

          <CollapsibleContent>
            {/* Multiple outcomes section */}
            <Show when={hasMultipleOutcomes()}>
              <div class='border-border-subtle space-y-2 border-t px-4 py-3'>
                <For each={completedOutcomeGroups()}>
                  {outcomeGroup => (
                    <CompletedOutcomeRow
                      study={study()}
                      outcomeGroup={outcomeGroup}
                      onOpenChecklist={props.onOpenChecklist}
                      getAssigneeName={props.getAssigneeName}
                      getOutcomeName={props.getOutcomeName}
                      getReconciliationProgress={props.getReconciliationProgress}
                    />
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

      {/* Previous Reviewers View Dialog (single outcome mode) */}
      <Show when={showPreviousReviewers() && firstGroup()}>
        <PreviousReviewersView
          study={study()}
          reconciliationProgress={props.getReconciliationProgress?.(
            firstGroup().outcomeId,
            firstGroup().type,
          )}
          getAssigneeName={props.getAssigneeName}
          onClose={() => setShowPreviousReviewers(false)}
        />
      </Show>
    </>
  );
}
