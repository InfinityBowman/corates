/**
 * TodoStudyRow - Study card for the todo tab
 * Multiple checklists shown as stacked sub-rows, single checklists inline.
 * PDFs expandable via chevron.
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronRightIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { sortStudyPdfs, getCitationLine } from '../study-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getChecklistMetadata, CHECKLIST_TYPES } from '@/checklist-registry';
import { PdfListItem } from '@/components/pdf/PdfListItem';
import { ChecklistForm } from './ChecklistForm';
import { getStatusLabel, getStatusStyle } from '@corates/shared/checklists';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectContext } from '../ProjectContext';

interface TodoStudyRowProps {
  study: any;
  members: any[];
  currentUserId: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  showChecklistForm: boolean;
  onToggleChecklistForm: () => void;
  onAddChecklist: (type: string, assigneeId: string, outcomeId: string | null) => void;
  onOpenChecklist: (checklistId: string) => void;
  onDeleteChecklist: (checklistId: string) => void;
  onViewPdf: (pdf: any) => void;
  onDownloadPdf: (pdf: any) => void;
  creatingChecklist: boolean;
}

export function TodoStudyRow({
  study,
  members,
  currentUserId,
  expanded,
  onToggleExpanded,
  showChecklistForm,
  onToggleChecklistForm,
  onAddChecklist,
  onOpenChecklist,
  onDeleteChecklist,
  onViewPdf,
  onDownloadPdf,
  creatingChecklist,
}: TodoStudyRowProps) {
  const { projectId } = useProjectContext();
  const [deleteChecklistId, setDeleteChecklistId] = useState<string | null>(null);

  const checklists = useMemo(() => study.checklists || [], [study.checklists]);
  const hasChecklists = checklists.length > 0;

  const meta = useProjectStore(s => s.projects[projectId]?.meta) as any;
  const outcomes: any[] = useMemo(() => meta?.outcomes || [], [meta?.outcomes]);

  const canAddMore = useMemo(() => {
    const hasAmstar2 = checklists.some((c: any) => c.type === CHECKLIST_TYPES.AMSTAR2);
    if (!hasAmstar2) return true;
    if (outcomes.length === 0) return false;

    const usedOutcomesByType: Record<string, Set<string>> = {};
    for (const checklist of checklists) {
      if (checklist.outcomeId) {
        if (!usedOutcomesByType[checklist.type]) usedOutcomesByType[checklist.type] = new Set();
        usedOutcomesByType[checklist.type].add(checklist.outcomeId);
      }
    }
    for (const outcome of outcomes) {
      const rob2Used = usedOutcomesByType[CHECKLIST_TYPES.ROB2]?.has(outcome.id);
      const robinsUsed = usedOutcomesByType[CHECKLIST_TYPES.ROBINS_I]?.has(outcome.id);
      if (!rob2Used || !robinsUsed) return true;
    }
    return false;
  }, [checklists, outcomes]);

  const getOutcomeName = useCallback(
    (outcomeId: string) => outcomes.find((o: any) => o.id === outcomeId)?.name || null,
    [outcomes],
  );

  const sortedPdfs = useMemo(() => sortStudyPdfs(study.pdfs || []), [study.pdfs]);
  const hasPdfs = sortedPdfs.length > 0;
  const citationLine = useMemo(() => getCitationLine(sortedPdfs, study), [sortedPdfs, study]);

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      if (!hasPdfs) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, [role="button"], [data-selectable]')) return;
      onToggleExpanded();
    },
    [hasPdfs, onToggleExpanded],
  );

  const handleConfirmDelete = useCallback(() => {
    if (deleteChecklistId) {
      onDeleteChecklist(deleteChecklistId);
      setDeleteChecklistId(null);
    }
  }, [deleteChecklistId, onDeleteChecklist]);

  const addCancelButton =
    (hasChecklists && canAddMore) || showChecklistForm ?
      <button
        onClick={e => {
          e.stopPropagation();
          onToggleChecklistForm();
        }}
        className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          showChecklistForm ?
            'text-red-500 hover:bg-red-50 hover:text-red-600'
          : 'bg-primary hover:bg-primary/90 text-white'
        }`}
        title={showChecklistForm ? 'Cancel' : 'Add another checklist'}
      >
        {showChecklistForm ?
          <XIcon className='size-4' />
        : <PlusIcon className='size-4' />}
        {showChecklistForm ? 'Cancel' : 'Add'}
      </button>
    : null;

  return (
    <div className='border-border bg-card hover:border-border overflow-hidden rounded-lg border transition-colors'>
      <Collapsible open={expanded} onOpenChange={onToggleExpanded}>
        {/* Header */}
        <div
          className={`flex flex-wrap items-center gap-3 px-4 py-3 select-none ${hasPdfs ? 'cursor-pointer' : ''}`}
          onClick={handleRowClick}
        >
          {hasPdfs && (
            <div className='-ml-1 shrink-0 p-1'>
              <ChevronRightIcon
                className={`text-muted-foreground/70 size-5 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
              />
            </div>
          )}

          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              <span className='text-foreground truncate font-medium'>{study.name}</span>
            </div>
            {citationLine && (
              <p
                className='text-muted-foreground w-fit cursor-text truncate text-xs select-text'
                data-selectable
              >
                {citationLine}
                {hasPdfs && (
                  <span className='text-muted-foreground/70'> -- {sortedPdfs.length} PDFs</span>
                )}
              </p>
            )}
            {!citationLine && hasPdfs && (
              <p className='text-muted-foreground/70 text-xs'>{sortedPdfs.length} PDFs</p>
            )}
          </div>

          {/* Single checklist inline */}
          {checklists.length === 1 &&
            (() => {
              const checklist = checklists[0];
              return (
                <>
                  <span
                    className='bg-secondary text-secondary-foreground inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium'
                    data-selectable
                  >
                    {(getChecklistMetadata(checklist.type) as any)?.name || 'Checklist'}
                  </span>
                  {checklist.outcomeId && (
                    <span
                      className='bg-secondary text-secondary-foreground inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium'
                      data-selectable
                    >
                      {getOutcomeName(checklist.outcomeId)}
                    </span>
                  )}
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(checklist.status)}`}
                    data-selectable
                  >
                    {getStatusLabel(checklist.status)}
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onOpenChecklist(checklist.id);
                    }}
                    className='bg-primary hover:bg-primary/90 shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors'
                  >
                    Open
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setDeleteChecklistId(checklist.id);
                    }}
                    className='text-muted-foreground shrink-0 p-1.5 transition-colors hover:text-red-600'
                    title='Delete checklist'
                    aria-label='Delete checklist'
                  >
                    <Trash2Icon className='size-4' />
                  </button>
                </>
              );
            })()}

          {/* No checklists */}
          {!hasChecklists && (
            <button
              onClick={e => {
                e.stopPropagation();
                onToggleChecklistForm();
              }}
              className='bg-primary hover:bg-primary/90 shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors'
            >
              Select Checklist
            </button>
          )}

          {addCancelButton}
        </div>

        {/* Multi-checklist sub-rows */}
        {checklists.length > 1 && (
          <div className='divide-border divide-y'>
            {checklists.map((checklist: any) => (
              <div key={checklist.id} className='flex items-center gap-3 px-4 py-2.5'>
                <div className='flex flex-1 flex-wrap items-center gap-1.5'>
                  <span className='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
                    {(getChecklistMetadata(checklist.type) as any)?.name || 'Checklist'}
                  </span>
                  {checklist.outcomeId && (
                    <span className='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
                      {getOutcomeName(checklist.outcomeId)}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusStyle(checklist.status)}`}
                  >
                    {getStatusLabel(checklist.status)}
                  </span>
                </div>
                <button
                  onClick={() => onOpenChecklist(checklist.id)}
                  className='bg-primary hover:bg-primary/90 shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors'
                >
                  Open
                </button>
                <button
                  onClick={() => setDeleteChecklistId(checklist.id)}
                  className='text-muted-foreground shrink-0 p-1.5 transition-colors hover:text-red-600'
                  title='Delete checklist'
                  aria-label='Delete checklist'
                >
                  <Trash2Icon className='size-4' />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Expandable PDFs */}
        <CollapsibleContent>
          {hasPdfs && (
            <div className='border-border flex flex-col gap-2 border-t px-4 py-3'>
              {sortedPdfs.map((pdf: any) => (
                <PdfListItem
                  key={pdf.id}
                  pdf={pdf}
                  onView={() => onViewPdf(pdf)}
                  onDownload={() => onDownloadPdf(pdf)}
                  readOnly
                />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Checklist Form */}
      <Collapsible open={showChecklistForm}>
        <CollapsibleContent>
          <div className='border-border border-t'>
            <ChecklistForm
              members={members}
              currentUserId={currentUserId}
              studyChecklists={study.checklists}
              onSubmit={onAddChecklist}
              onCancel={onToggleChecklistForm}
              loading={creatingChecklist}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteChecklistId !== null}
        onOpenChange={open => !open && setDeleteChecklistId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='danger' />
            <div>
              <AlertDialogTitle>Delete Checklist</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this checklist and all its data. This action cannot be
                undone.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
