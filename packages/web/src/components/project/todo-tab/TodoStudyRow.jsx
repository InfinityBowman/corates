/**
 * TodoStudyRow - Compact study card for the todo tab
 *
 * Displays study info, checklist status, and collapsible PDF section.
 * Clicking whitespace on the header row toggles the PDF section.
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { getChecklistMetadata } from '@/checklist-registry';
import { PdfListItem } from '@pdf';
import ChecklistForm from './ChecklistForm.jsx';
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

  // Handle row click - toggle unless clicking on interactive elements or selectable text
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
        <div
          class={`flex items-center gap-3 px-4 py-3 select-none ${hasPdfs() ? 'cursor-pointer' : ''}`}
          onClick={handleRowClick}
        >
          {/* Chevron indicator (only if has PDFs) */}
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

          {/* Checklist type badge - selectable */}
          <Show when={checklist()}>
            <span
              class='bg-secondary text-secondary-foreground inline-flex shrink-0 cursor-text items-center rounded-full px-2 py-1 text-xs font-medium select-text'
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
              class='bg-primary hover:bg-primary/90 focus:ring-primary shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none'
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
              class='bg-primary hover:bg-primary/90 focus:ring-primary shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none'
            >
              Select Checklist
            </button>
          </Show>
        </div>
        <CollapsibleContent>
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

      {/* Checklist Form (when adding a new checklist) - outside collapsible */}
      <Show when={props.showChecklistForm}>
        <div class='border-border-subtle border-t'>
          <ChecklistForm
            members={props.members}
            currentUserId={props.currentUserId}
            studyChecklists={study().checklists}
            onSubmit={(type, assigneeId, outcomeId) =>
              props.onAddChecklist?.(type, assigneeId, outcomeId)
            }
            onCancel={() => props.onToggleChecklistForm?.()}
            loading={props.creatingChecklist}
          />
        </div>
      </Show>
    </div>
  );
}
