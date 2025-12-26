/**
 * CompletedStudyRow - Compact study row for the completed tab
 *
 * Displays study info, completed checklist(s), collapsible PDF section, and
 * button to view previous reviewer checklists (for dual-reviewer studies).
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { Collapsible } from '@corates/ui';
import { getChecklistMetadata } from '@/checklist-registry';
import PdfListItem from '@/components/checklist-ui/pdf/PdfListItem.jsx';
import { getCompletedChecklists } from '@/lib/checklist-domain.js';
import { getStatusLabel, getStatusStyle } from '@/constants/checklist-status.js';
import PreviousReviewersView from './PreviousReviewersView.jsx';

export default function CompletedStudyRow(props) {
  // props.study: Study object with pdfs and checklists arrays
  // props.onOpenChecklist: (checklistId) => void
  // props.onViewPdf: (pdf) => void
  // props.onDownloadPdf: (pdf) => void
  // props.reconciliationProgress: Object with checklist1Id and checklist2Id (optional)
  // props.getAssigneeName: (userId) => string

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

  // Get completed checklists
  const completedChecklists = createMemo(() => {
    return getCompletedChecklists(study());
  });

  // Check if we have previous reviewers to show
  const hasPreviousReviewers = () => {
    return !!props.reconciliationProgress?.checklist1Id && !!props.reconciliationProgress?.checklist2Id;
  };

  return (
    <>
      <div class='overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-300'>
        <Collapsible
          open={expanded()}
          onOpenChange={({ open }) => {
            // Only toggle if there are PDFs to show
            if (hasPdfs()) {
              setExpanded(open);
            }
          }}
          trigger={
            <div
              class={`flex items-center gap-3 px-4 py-3 select-none ${hasPdfs() ? 'cursor-pointer' : ''}`}
            >
              {/* Chevron indicator (only if has PDFs) */}
              <Show when={hasPdfs()}>
                <div class='-ml-1 shrink-0 p-1'>
                  <BiRegularChevronRight
                    class={`h-5 w-5 text-gray-400 transition-transform duration-200 ${expanded() ? 'rotate-90' : ''}`}
                  />
                </div>
              </Show>

              {/* Study info */}
              <div class='min-w-0 flex-1'>
                <div class='flex items-center gap-2'>
                  <span class='truncate font-medium text-gray-900'>{study().name}</span>
                </div>
                {/* Citation line - selectable */}
                <Show when={citationLine()}>
                  <p
                    class='w-fit cursor-text truncate text-xs text-gray-500 select-text'
                    data-selectable
                  >
                    {citationLine()}
                    <Show when={hasPdfs()}>
                      <span class='text-gray-400'> · {pdfCount()} PDFs</span>
                    </Show>
                  </p>
                </Show>
                <Show when={!citationLine() && hasPdfs()}>
                  <p class='text-xs text-gray-400'>{pdfCount()} PDFs</p>
                </Show>
              </div>

              {/* Checklist type badge - selectable */}
              <Show when={completedChecklists().length > 0}>
                <span
                  class='inline-flex shrink-0 cursor-text items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 select-text'
                  data-selectable
                >
                  {getChecklistMetadata(completedChecklists()[0]?.type)?.name || 'Checklist'}
                </span>
              </Show>

              {/* Checklist status badge */}
              <Show when={completedChecklists().length > 0}>
                <span
                  class={`inline-flex shrink-0 cursor-text items-center rounded-full px-2.5 py-1 text-xs font-medium select-text ${getStatusStyle(completedChecklists()[0]?.status)}`}
                  data-selectable
                >
                  {getStatusLabel(completedChecklists()[0]?.status)}
                </span>
              </Show>

              {/* View Previous Reviewers button (only for dual-reviewer studies) */}
              <Show when={hasPreviousReviewers()}>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setShowPreviousReviewers(true);
                  }}
                  class='shrink-0 rounded-lg bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'
                >
                  View Previous
                </button>
              </Show>

              {/* Open checklist button */}
              <Show when={completedChecklists().length > 0}>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    props.onOpenChecklist?.(completedChecklists()[0].id);
                  }}
                  class='shrink-0 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700'
                >
                  Open
                </button>
              </Show>
            </div>
          }
        >
          {/* Expanded PDF Section */}
          <Show when={hasPdfs()}>
            <div class='space-y-2 border-t border-gray-100 px-4 py-3'>
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
        </Collapsible>
      </div>

      {/* Previous Reviewers View Dialog */}
      <Show when={showPreviousReviewers()}>
        <PreviousReviewersView
          study={study()}
          reconciliationProgress={props.reconciliationProgress}
          getAssigneeName={props.getAssigneeName}
          onClose={() => setShowPreviousReviewers(false)}
        />
      </Show>
    </>
  );
}
