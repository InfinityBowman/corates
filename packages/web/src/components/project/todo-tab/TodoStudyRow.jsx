/**
 * TodoStudyRow - Compact study card for the todo tab
 *
 * Displays study info, checklist status, and collapsible PDF section.
 * Supports multiple checklists per study (one per outcome for ROB-2/ROBINS-I).
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { BiRegularChevronRight } from 'solid-icons/bi';
import { FiPlus, FiTrash2, FiX } from 'solid-icons/fi';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogPositioner,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { getChecklistMetadata, CHECKLIST_TYPES } from '@/checklist-registry';
import { PdfListItem } from '@pdf';
import ChecklistForm from './ChecklistForm.jsx';
import { getStatusLabel, getStatusStyle } from '@/constants/checklist-status.js';
import projectStore from '@/stores/projectStore.js';
import { useProjectContext } from '../ProjectContext.jsx';

export default function TodoStudyRow(props) {
  // props.study: Study object with pdfs and checklists arrays
  // props.members: Array of project members
  // props.currentUserId: Current user's ID
  // props.expanded: boolean - controlled expanded state
  // props.onToggleExpanded: () => void
  // props.onOpenChecklist: (checklistId) => void
  // props.onDeleteChecklist: (checklistId) => void
  // props.onAddChecklist: (type, assigneeId, outcomeId) => void
  // props.onViewPdf: (pdf) => void
  // props.onDownloadPdf: (pdf) => void
  // props.showChecklistForm: boolean
  // props.onToggleChecklistForm: () => void
  // props.creatingChecklist: boolean

  const { projectId } = useProjectContext();

  // Delete confirmation dialog state
  const [deleteChecklistId, setDeleteChecklistId] = createSignal(null);
  const showDeleteDialog = () => deleteChecklistId() !== null;

  const handleConfirmDelete = () => {
    const checklistId = deleteChecklistId();
    if (checklistId) {
      props.onDeleteChecklist?.(checklistId);
      setDeleteChecklistId(null);
    }
  };

  const study = () => props.study;
  const checklists = () => study().checklists || [];
  const hasChecklists = () => checklists().length > 0;

  // Get project outcomes
  const meta = () => projectStore.getMeta(projectId);
  const outcomes = createMemo(() => meta()?.outcomes || []);

  // Check if user can add more checklists (has unused outcomes for ROB2/ROBINS_I, or no AMSTAR2 yet)
  const canAddMore = createMemo(() => {
    const userChecklists = checklists();
    const projectOutcomes = outcomes();

    // For AMSTAR2: can add if user doesn't have one yet
    const hasAmstar2 = userChecklists.some(c => c.type === CHECKLIST_TYPES.AMSTAR2);
    if (!hasAmstar2) return true;

    // For ROB2/ROBINS_I: can add if there are unused outcomes
    if (projectOutcomes.length === 0) return false;

    const usedOutcomesByType = {};
    for (const checklist of userChecklists) {
      if (checklist.outcomeId) {
        if (!usedOutcomesByType[checklist.type]) {
          usedOutcomesByType[checklist.type] = new Set();
        }
        usedOutcomesByType[checklist.type].add(checklist.outcomeId);
      }
    }

    // Check if any outcome is available for ROB2 or ROBINS_I
    for (const outcome of projectOutcomes) {
      const rob2Used = usedOutcomesByType[CHECKLIST_TYPES.ROB2]?.has(outcome.id);
      const robinsUsed = usedOutcomesByType[CHECKLIST_TYPES.ROBINS_I]?.has(outcome.id);
      if (!rob2Used || !robinsUsed) return true;
    }

    return false;
  });

  // Get outcome name by ID
  const getOutcomeName = outcomeId => {
    if (!outcomeId) return null;
    const outcome = outcomes().find(o => o.id === outcomeId);
    return outcome?.name || null;
  };

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

  // Determine if row should be expandable (has PDFs or multiple checklists)
  const isExpandable = () => hasPdfs() || checklists().length > 1;

  // Handle row click - toggle unless clicking on interactive elements or selectable text
  const handleRowClick = e => {
    if (!isExpandable()) return;
    const target = e.target;
    const interactive = target.closest('button, [role="button"], [data-selectable]');
    if (interactive) return;
    props.onToggleExpanded?.();
  };

  return (
    <div class='border-border bg-card hover:border-border-strong overflow-hidden rounded-lg border transition-colors'>
      <Collapsible open={props.expanded}>
        <div
          class={`flex items-center gap-3 px-4 py-3 select-none ${isExpandable() ? 'cursor-pointer' : ''}`}
          onClick={handleRowClick}
        >
          {/* Chevron indicator */}
          <Show when={isExpandable()}>
            <div class='-ml-1 shrink-0 p-1'>
              <BiRegularChevronRight
                class={`text-muted-foreground/70 h-5 w-5 transition-transform duration-200 ${props.expanded ? 'rotate-90' : ''}`}
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
                <Show when={checklists().length > 1}>
                  <span class='text-muted-foreground/70'> · {checklists().length} checklists</span>
                </Show>
              </p>
            </Show>
            <Show when={!citationLine() && (hasPdfs() || checklists().length > 1)}>
              <p class='text-muted-foreground/70 text-xs'>
                <Show when={hasPdfs()}>{pdfCount()} PDFs</Show>
                <Show when={hasPdfs() && checklists().length > 1}> · </Show>
                <Show when={checklists().length > 1}>{checklists().length} checklists</Show>
              </p>
            </Show>
          </div>

          {/* Single checklist: show inline */}
          <Show when={checklists().length === 1}>
            {(() => {
              const checklist = checklists()[0];
              return (
                <>
                  {/* Checklist type badge */}
                  <span
                    class='bg-secondary text-secondary-foreground inline-flex shrink-0 cursor-text items-center rounded-full px-2 py-1 text-xs font-medium select-text'
                    data-selectable
                  >
                    {getChecklistMetadata(checklist.type)?.name || 'Checklist'}
                  </span>

                  {/* Outcome badge if applicable */}
                  <Show when={checklist.outcomeId}>
                    <span
                      class='bg-secondary text-secondary-foreground inline-flex shrink-0 cursor-text items-center rounded-full px-2 py-1 text-xs font-medium select-text'
                      data-selectable
                    >
                      {getOutcomeName(checklist.outcomeId)}
                    </span>
                  </Show>

                  {/* Status badge */}
                  <span
                    class={`inline-flex shrink-0 cursor-text items-center rounded-full px-2.5 py-1 text-xs font-medium select-text ${getStatusStyle(checklist.status)}`}
                    data-selectable
                  >
                    {getStatusLabel(checklist.status)}
                  </span>

                  {/* Open button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      props.onOpenChecklist?.(checklist.id);
                    }}
                    class='bg-primary hover:bg-primary/90 focus:ring-primary shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none'
                  >
                    Open
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setDeleteChecklistId(checklist.id);
                    }}
                    class='text-muted-foreground shrink-0 p-1.5 transition-colors hover:text-red-600'
                    title='Delete checklist'
                  >
                    <FiTrash2 class='h-4 w-4' />
                  </button>
                </>
              );
            })()}
          </Show>

          {/* Multiple checklists: show count, details in expanded */}
          <Show when={checklists().length > 1}>
            <span class='text-muted-foreground text-sm'>{checklists().length} checklists</span>
          </Show>

          {/* No checklists: show Select Checklist button */}
          <Show when={!hasChecklists()}>
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

          {/* Add/Cancel toggle button (when has checklists and can add more, or form is open) */}
          <Show when={(hasChecklists() && canAddMore()) || props.showChecklistForm}>
            <button
              onClick={e => {
                e.stopPropagation();
                props.onToggleChecklistForm?.();
              }}
              class={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
                props.showChecklistForm ?
                  'text-red-500 hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:ring-red-200'
                : 'bg-primary hover:bg-primary/90 focus:ring-primary text-white focus:ring-2'
              }`}
              title={props.showChecklistForm ? 'Cancel' : 'Add another checklist'}
            >
              <Show when={props.showChecklistForm} fallback={<FiPlus class='h-4 w-4' />}>
                <FiX class='h-4 w-4' />
              </Show>
              {props.showChecklistForm ? 'Cancel' : 'Add'}
            </button>
          </Show>
        </div>

        <CollapsibleContent>
          {/* Multiple checklists list */}
          <Show when={checklists().length > 1}>
            <div class='border-border-subtle space-y-1 border-t px-4 py-3'>
              <For each={checklists()}>
                {checklist => (
                  <div class='bg-muted/50 flex items-center justify-between rounded-lg p-3'>
                    <div class='flex items-center gap-2'>
                      <span class='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
                        {getChecklistMetadata(checklist.type)?.name || 'Checklist'}
                      </span>
                      <Show when={checklist.outcomeId}>
                        <span class='text-muted-foreground text-sm'>
                          {getOutcomeName(checklist.outcomeId)}
                        </span>
                      </Show>
                      <span
                        class={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusStyle(checklist.status)}`}
                      >
                        {getStatusLabel(checklist.status)}
                      </span>
                    </div>
                    <div class='flex items-center gap-2'>
                      <button
                        onClick={() => props.onOpenChecklist?.(checklist.id)}
                        class='bg-primary hover:bg-primary/90 focus:ring-primary rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none'
                      >
                        Open
                      </button>
                      <button
                        onClick={() => setDeleteChecklistId(checklist.id)}
                        class='text-muted-foreground p-1.5 transition-colors hover:text-red-600'
                        title='Delete checklist'
                      >
                        <FiTrash2 class='h-4 w-4' />
                      </button>
                    </div>
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

      {/* Checklist Form (when adding a new checklist) - animated */}
      <Collapsible open={props.showChecklistForm}>
        <CollapsibleContent>
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
        </CollapsibleContent>
      </Collapsible>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={showDeleteDialog()}
        onOpenChange={open => !open && setDeleteChecklistId(null)}
      >
        <AlertDialogBackdrop />
        <AlertDialogPositioner>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogIcon variant='danger' />
              <div>
                <AlertDialogTitle>Delete Checklist</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this checklist and all its data. This action cannot
                  be undone.
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant='danger' onClick={handleConfirmDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogPositioner>
      </AlertDialog>
    </div>
  );
}
