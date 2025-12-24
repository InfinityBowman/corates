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
import { getStatusLabel, getStatusStyle } from '@/constants/checklist-status.js';

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

  return (
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
            <Show when={checklist()}>
              <span
                class='inline-flex shrink-0 cursor-text items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 select-text'
                data-selectable
              >
                {getChecklistMetadata(checklist().type)?.name || 'Checklist'}
              </span>
            </Show>

            {/* Checklist status badge */}
            <Show when={checklist()}>
              <span
                class={`inline-flex shrink-0 cursor-text items-center rounded-full px-2.5 py-1 text-xs font-medium select-text ${getStatusStyle(checklist().status)}`}
                data-selectable
              >
                {getStatusLabel(checklist().status)}
              </span>
            </Show>

            {/* Open checklist button (when checklist exists) */}
            <Show when={checklist()}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  props.onOpenChecklist?.(checklist().id);
                }}
                class='shrink-0 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700'
              >
                Open
              </button>
            </Show>

            {/* Select Checklist button (when no checklist) */}
            <Show when={!checklist()}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  props.onToggleChecklistForm?.();
                }}
                class='shrink-0 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700'
              >
                Select Checklist
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
