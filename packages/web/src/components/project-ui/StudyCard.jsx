/**
 * StudyCard component - Displays a single study with its checklists and controls for
 * managing PDFs, editing the study name, and creating checklists.
 *
 * Props
 * @param {Object} props - Component props
 * @param {Object} props.study - The study object to display
 * @param {string} props.study.name - The display name of the study
 * @param {Array<Object>} [props.study.pdfs] - Array of PDF objects for the study (if any)
 * @param {string} [props.study.firstAuthor] - First author for the study citation line
 * @param {string|number} [props.study.publicationYear] - Publication year for the study
 * @param {string} [props.study.journal] - Journal name for the study
 * @param {Array<Object>} [props.study.checklists] - Array of checklist objects attached to this study
 * @param {Array<Object>} [props.members] - List of project members used to populate assignee dropdowns
 * @param {string|number} [props.currentUserId] - Current user id used to pre-select assignee in forms
 * @param {boolean} [props.showChecklistForm] - Whether the create-checklist form is visible
 * @param {boolean} [props.creatingChecklist] - Loading state for checklist creation
 * @param {function(type: string, assigneeId: string|number)} props.onAddChecklist - Creates a new checklist for a study
 * @param {function(Object): void} [props.onViewPdf] - Called to open/view a PDF (passed a PDF object from study.pdfs)
 * @param {function(Object): void} [props.onDownloadPdf] - Called to download a PDF (passed a PDF object from study.pdfs)
 * @param {function(): void} [props.onToggleChecklistForm] - Toggles visibility for the checklist creation form
 * @param {function(checklistId: string|number): void} [props.onOpenChecklist] - Open a specific checklist for editing/review
 * @param {function(checklistId: string|number, updates: Object): void} [props.onUpdateChecklist] - Update checklist metadata
 * @param {function(checklistId: string|number): void} [props.onDeleteChecklist] - Delete a checklist
 * @param {function(assigneeId: string|number): string} [props.getAssigneeName] - Get member display name by id
 *
 * Behavior
 * - Renders a card header with the study title and optional citation line
 * - Shows a collapsible PDF section with all PDFs (read-only, view/download only)
 * - Allows creating new checklists via an `Add Checklist` button and `ChecklistForm`
 * - Renders existing checklists using `ChecklistRow` and forwards checklist actions
 */

import { For, Show, createSignal, createMemo } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { Collapsible } from '@corates/ui';
import ChecklistForm from './ChecklistForm.jsx';
import ChecklistRow from './ChecklistRow.jsx';
import PdfListItem from '@/components/checklist-ui/pdf/PdfListItem.jsx';

export default function StudyCard(props) {
  const [pdfSectionOpen, setPdfSectionOpen] = createSignal(false);

  const handleCreateChecklist = (type, assigneeId) => {
    props.onAddChecklist(type, assigneeId);
  };

  // Check if study has PDFs
  const hasPdfs = () => props.study.pdfs && props.study.pdfs.length > 0;
  const pdfCount = () => props.study.pdfs?.length || 0;

  // Sort PDFs: primary first, then protocol, then secondary by uploadedAt desc
  const sortedPdfs = createMemo(() => {
    if (!hasPdfs()) return [];
    return [...props.study.pdfs].sort((a, b) => {
      const tagOrder = { primary: 0, protocol: 1, secondary: 2 };
      const tagA = tagOrder[a.tag] ?? 2;
      const tagB = tagOrder[b.tag] ?? 2;
      if (tagA !== tagB) return tagA - tagB;
      return (b.uploadedAt || 0) - (a.uploadedAt || 0);
    });
  });

  return (
    <div class='bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden'>
      {/* Study Header */}
      <div class='p-4 border-b border-gray-200 bg-gray-50'>
        <div class='flex items-center justify-between'>
          <div class='flex-1'>
            <div class='flex items-center gap-2'>
              <h3 class='text-lg font-semibold text-gray-900'>{props.study.name}</h3>
            </div>
            {/* Author/Year citation line */}
            <Show when={props.study.firstAuthor || props.study.publicationYear}>
              <p class='text-sm text-gray-600 mt-0.5'>
                <span class='font-medium'>{props.study.firstAuthor || 'Unknown'}</span>
                {props.study.publicationYear && ` (${props.study.publicationYear})`}
                <Show when={props.study.journal}>
                  <span class='mx-1'>-</span>
                  <span class='italic text-gray-500'>{props.study.journal}</span>
                </Show>
              </p>
            </Show>
          </div>
          <div class='flex items-center gap-2'>
            <Show when={!props.hideAddChecklist}>
              <button
                onClick={() => props.onToggleChecklistForm()}
                class='inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors gap-1'
              >
                Select Checklist
              </button>
            </Show>
          </div>
        </div>
      </div>

      {/* Collapsible PDF Section */}
      <Show when={hasPdfs()}>
        <div class='border-b border-gray-200'>
          <Collapsible
            open={pdfSectionOpen()}
            onOpenChange={setPdfSectionOpen}
            trigger={() => (
              <div class='flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors'>
                <BiRegularChevronRight
                  class={`w-4 h-4 text-gray-400 transition-transform duration-200 ${pdfSectionOpen() ? 'rotate-90' : ''}`}
                />
                <span class='text-sm font-medium text-gray-700'>PDFs ({pdfCount()})</span>
              </div>
            )}
          >
            <div class='px-4 pb-4 space-y-2'>
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
          </Collapsible>
        </div>
      </Show>

      {/* Add Checklist Form */}
      <Show when={props.showChecklistForm}>
        <ChecklistForm
          members={props.members}
          currentUserId={props.currentUserId}
          onSubmit={handleCreateChecklist}
          onCancel={() => props.onToggleChecklistForm()}
          loading={props.creatingChecklist}
        />
      </Show>

      {/* Checklists List */}
      <Show
        when={props.study.checklists?.length > 0}
        fallback={
          <div class='p-4 text-center text-gray-400 text-sm'>No checklists in this study yet</div>
        }
      >
        <div class='divide-y divide-gray-200'>
          <For each={props.study.checklists}>
            {checklist => (
              <ChecklistRow
                checklist={checklist}
                members={props.members}
                onOpen={() => props.onOpenChecklist(checklist.id)}
                onUpdate={updates => props.onUpdateChecklist?.(checklist.id, updates)}
                onDelete={() => props.onDeleteChecklist?.(checklist.id)}
                getAssigneeName={props.getAssigneeName}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
