/**
 * TodoStudyRow - Study card for the todo tab
 * Multiple checklists shown as stacked sub-rows, single checklists inline.
 * PDFs expandable via chevron.
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronRightIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
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
import { useProjectOutcomes } from '@/project/workspace-data';
import type { StudyInfo, PdfEntry, MemberEntry } from '@/stores/projectStore';
import { useProjectContext } from '../ProjectContext';

function DisabledAddButton({ reason }: { reason: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(buttonVariants(), 'cursor-not-allowed opacity-50')}
          role='button'
          aria-disabled='true'
          onClick={e => e.stopPropagation()}
        >
          <PlusIcon className='size-4' />
          Add
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

interface TodoStudyRowProps {
  study: StudyInfo;
  members: MemberEntry[];
  currentUserId: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  showChecklistForm: boolean;
  onToggleChecklistForm: () => void;
  onAddChecklist: (type: string, assigneeId: string, outcomeId: string | null) => void;
  onOpenChecklist: (checklistId: string) => void;
  onDeleteChecklist: (checklistId: string) => void;
  onViewPdf: (pdf: PdfEntry) => void;
  onDownloadPdf: (pdf: PdfEntry) => void;
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

  const checklists = study.checklists;
  const hasChecklists = checklists.length > 0;

  const outcomes = useProjectOutcomes(projectId);

  const canAddMore = useMemo(() => {
    const hasAmstar2 = checklists.some(c => c.type === CHECKLIST_TYPES.AMSTAR2);
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
    (outcomeId: string) => outcomes.find(o => o.id === outcomeId)?.name || null,
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

  const addBlockedReason =
    !hasChecklists || canAddMore ? null
    : outcomes.length === 0 ? 'Add an outcome before starting a RoB 2 or ROBINS-I appraisal.'
    : 'You already have an appraisal for every outcome in this project.';

  const addCancelButton =
    showChecklistForm ?
      <Button
        variant='ghost'
        onClick={e => {
          e.stopPropagation();
          onToggleChecklistForm();
        }}
        className='text-destructive hover:bg-destructive/5 hover:text-destructive'
        title='Cancel'
      >
        <XIcon className='size-4' />
        Cancel
      </Button>
    : hasChecklists && addBlockedReason ? <DisabledAddButton reason={addBlockedReason} />
    : hasChecklists ?
      <Button
        onClick={e => {
          e.stopPropagation();
          onToggleChecklistForm();
        }}
        title='Add another appraisal to this study'
      >
        <PlusIcon className='size-4' />
        Add
      </Button>
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
                  <Badge variant='secondary' data-selectable>
                    {getChecklistMetadata(checklist.type).name}
                  </Badge>
                  {checklist.outcomeId && (
                    <Badge variant='secondary' data-selectable>
                      {getOutcomeName(checklist.outcomeId)}
                    </Badge>
                  )}
                  <Badge
                    variant='secondary'
                    className={getStatusStyle(checklist.status)}
                    data-selectable
                  >
                    {getStatusLabel(checklist.status)}
                  </Badge>
                  <Button
                    onClick={e => {
                      e.stopPropagation();
                      onOpenChecklist(checklist.id);
                    }}
                  >
                    Open
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={e => {
                      e.stopPropagation();
                      setDeleteChecklistId(checklist.id);
                    }}
                    className='text-muted-foreground hover:text-red-600'
                    title='Delete appraisal'
                    aria-label='Delete appraisal'
                  >
                    <Trash2Icon className='size-4' />
                  </Button>
                </>
              );
            })()}

          {/* No checklists */}
          {!hasChecklists && (
            <Button
              onClick={e => {
                e.stopPropagation();
                onToggleChecklistForm();
              }}
            >
              Select appraisal tool
            </Button>
          )}

          {addCancelButton}
        </div>

        {/* Multi-checklist sub-rows */}
        {checklists.length > 1 && (
          <div className='divide-border divide-y'>
            {checklists.map(checklist => (
              <div key={checklist.id} className='flex items-center gap-3 px-4 py-2.5'>
                <div className='flex flex-1 flex-wrap items-center gap-1.5'>
                  <Badge variant='secondary'>{getChecklistMetadata(checklist.type).name}</Badge>
                  {checklist.outcomeId && (
                    <Badge variant='secondary'>{getOutcomeName(checklist.outcomeId)}</Badge>
                  )}
                  <Badge variant='secondary' className={getStatusStyle(checklist.status)}>
                    {getStatusLabel(checklist.status)}
                  </Badge>
                </div>
                <Button onClick={() => onOpenChecklist(checklist.id)}>Open</Button>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => setDeleteChecklistId(checklist.id)}
                  className='text-muted-foreground hover:text-red-600'
                  title='Delete appraisal'
                  aria-label='Delete appraisal'
                >
                  <Trash2Icon className='size-4' />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Expandable PDFs */}
        <CollapsibleContent>
          {hasPdfs && (
            <div className='border-border flex flex-col gap-2 border-t px-4 py-3'>
              {sortedPdfs.map(pdf => (
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
              <AlertDialogTitle>Delete this appraisal?</AlertDialogTitle>
              <AlertDialogDescription>
                Your answers and notes on this checklist are deleted for good. The study and its
                PDFs stay in the project. This cannot be undone.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={handleConfirmDelete}>
              Delete checklist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
