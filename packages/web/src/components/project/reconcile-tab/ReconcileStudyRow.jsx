/**
 * ReconcileStudyRow - Compact study row for the reconcile tab
 *
 * Displays study info, reconciliation status, and collapsible PDF section.
 * Clicking whitespace on the header row toggles the PDF section.
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { BsFileDiff } from 'solid-icons/bs';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import { isReconciledChecklist } from '@/lib/checklist-domain.js';
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

  // Get the individual reviewer checklists awaiting reconciliation
  const awaitingReconcileChecklists = () => {
    return (study().checklists || []).filter(
      c => !isReconciledChecklist(c) && c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
    );
  };

  // Check if ready for reconciliation (both reviewers have completed their checklists)
  const isReady = () => awaitingReconcileChecklists().length === 2;

  // Start reconciliation - directly compare the two checklists awaiting reconciliation
  const startReconciliation = () => {
    const [checklist1, checklist2] = awaitingReconcileChecklists();
    if (checklist1 && checklist2) {
      props.onReconcile?.(checklist1.id, checklist2.id);
    }
  };

  // Get reviewer name for a checklist
  const getReviewerName = checklist => {
    if (!checklist.assignedTo) return 'Unknown';
    return props.getAssigneeName?.(checklist.assignedTo) || 'Unknown';
  };

  // Handle row click - toggle unless clicking on interactive elements or selectable text
  const handleRowClick = e => {
    if (!hasPdfs()) return;
    const target = e.target;
    const interactive = target.closest('button, [role="button"], [data-selectable]');
    if (interactive) return;
    setExpanded(!expanded());
  };

  return (
    <div class='overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-300'>
      <Collapsible open={expanded()}>
        <div
          class={`flex items-center gap-3 px-4 py-3 select-none ${hasPdfs() ? 'cursor-pointer' : ''}`}
          onClick={handleRowClick}
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

          {/* Reconciliation status tag */}
          <ReconcileStatusTag study={study()} getAssigneeName={props.getAssigneeName} />

          {/* Reviewer info when ready */}
          <Show when={isReady()}>
            <div class='flex items-center gap-2 text-sm text-gray-700'>
              <Show when={awaitingReconcileChecklists()[0]}>
                {checklist => <span>{getReviewerName(checklist())}</span>}
              </Show>
              <span class='text-gray-400'>vs</span>
              <Show when={awaitingReconcileChecklists()[1]}>
                {checklist => <span>{getReviewerName(checklist())}</span>}
              </Show>
            </div>
          </Show>

          {/* Reconcile button */}
          <button
            onClick={e => {
              e.stopPropagation();
              startReconciliation();
            }}
            disabled={!isReady()}
            class={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isReady() ?
                'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none'
              : 'cursor-not-allowed bg-gray-200 text-gray-500'
            }`}
          >
            <BsFileDiff class='h-4 w-4' />
            Reconcile
          </button>
        </div>
        <CollapsibleContent>
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
