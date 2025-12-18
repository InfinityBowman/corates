/**
 * TodoStudyRow - Compact study card for the todo tab
 *
 * Displays study info, checklist status, and collapsible PDF section.
 * Clicking whitespace on the header row toggles the PDF section.
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { Collapsible } from '@corates/ui';
import { getChecklistMetadata } from '@/checklist-registry';
import PdfListItem from '@/components/checklist-ui/pdf/PdfListItem.jsx';
import ChecklistForm from '../ChecklistForm.jsx';

export default function TodoStudyRow(props) {
  // props.study: Study object with pdfs and checklists arrays
  // props.members: Array of project members
  // props.currentUserId: Current user's ID
  // props.onOpenChecklist: (checklistId) => void
  // props.onAddChecklist: (type, assigneeId) => void
  // props.onViewPdf: (pdf) => void
  // props.onDownloadPdf: (pdf) => void
  // props.showChecklistForm: boolean
  // props.onToggleChecklistForm: () => void
  // props.creatingChecklist: boolean

  const [expanded, setExpanded] = createSignal(false);

  const study = () => props.study;
  const checklist = () => study().checklists?.[0]; // In todo tab, user sees only their checklist

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

  // Status badge styling
  const getStatusStyle = status => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // Handle header click - toggle unless clicking on interactive elements or selectable text
  const handleHeaderClick = e => {
    // Don't toggle if clicking on interactive elements or selectable text areas
    const target = e.target;
    const interactive = target.closest(
      'button, [role="button"], [role="menuitem"], input, textarea, [data-selectable]',
    );
    if (interactive) return;

    // Only toggle if there are PDFs to show
    if (hasPdfs()) {
      setExpanded(prev => !prev);
    }
  };

  return (
    <div class='bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors overflow-hidden'>
      <Collapsible
        open={expanded()}
        onOpenChange={setExpanded}
        trigger={api => (
          <div
            {...api.getTriggerProps()}
            onClick={handleHeaderClick}
            class={`flex items-center gap-3 px-4 py-3 select-none ${hasPdfs() ? 'cursor-pointer' : ''}`}
          >
            {/* Chevron indicator (only if has PDFs) */}
            <Show when={hasPdfs()}>
              <div class='shrink-0 p-1 -ml-1'>
                <BiRegularChevronRight
                  class={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expanded() ? 'rotate-90' : ''}`}
                />
              </div>
            </Show>

            {/* Study info */}
            <div class='flex-1 min-w-0'>
              <div class='flex items-center gap-2'>
                <span class='font-medium text-gray-900 truncate'>{study().name}</span>
              </div>
              {/* Citation line - selectable */}
              <Show when={citationLine()}>
                <p
                  class='text-xs text-gray-500 truncate select-text cursor-text w-fit'
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
            <Show when={checklist()}>
              <span
                class='shrink-0 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 select-text cursor-text'
                data-selectable
              >
                {getChecklistMetadata(checklist().type)?.name || 'Checklist'}
              </span>
            </Show>

            {/* Checklist status badge */}
            <Show when={checklist()}>
              <span
                class={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium  select-text cursor-text ${getStatusStyle(checklist().status)}`}
                data-selectable
              >
                {checklist().status === 'in-progress' ?
                  'In Progress'
                : checklist().status === 'completed' ?
                  'Completed'
                : 'Pending'}
              </span>
            </Show>

            {/* Open checklist button (when checklist exists) */}
            <Show when={checklist()}>
              <button
                onClick={() => props.onOpenChecklist?.(checklist().id)}
                class='shrink-0 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
              >
                Open
              </button>
            </Show>

            {/* Select Checklist button (when no checklist) */}
            <Show when={!checklist()}>
              <button
                onClick={() => props.onToggleChecklistForm?.()}
                class='shrink-0 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
              >
                Select Checklist
              </button>
            </Show>
          </div>
        )}
      >
        {/* Expanded PDF Section */}
        <Show when={hasPdfs()}>
          <div class='border-t border-gray-100 px-4 py-3 space-y-2'>
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

      {/* Checklist Form (when adding a new checklist) - outside collapsible */}
      <Show when={props.showChecklistForm}>
        <div class='border-t border-gray-100'>
          <ChecklistForm
            members={props.members}
            currentUserId={props.currentUserId}
            onSubmit={(type, assigneeId) => props.onAddChecklist?.(type, assigneeId)}
            onCancel={() => props.onToggleChecklistForm?.()}
            loading={props.creatingChecklist}
          />
        </div>
      </Show>
    </div>
  );
}
