/**
 * ReconcileStudyRow - Study row for the reconcile tab
 * Multi-outcome: stacked READY/WAITING sections. Single-outcome: inline controls.
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronRightIcon, GitCompareArrowsIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { sortStudyPdfs, getCitationLine } from '../study-utils';
import { CHECKLIST_STATUS } from '@/constants/checklist-status';
import { getChecklistMetadata } from '@/checklist-registry';
import {
  isReconciledChecklist,
  getReconciliationChecklistsByOutcome,
} from '@/lib/checklist-domain.js';
import { PdfListItem } from '@/components/pdf/PdfListItem';
import { ReconcileStatusTag } from './ReconcileStatusTag';

/* eslint-disable no-unused-vars */
interface ReconcileStudyRowProps {
  study: any;
  onReconcile: (checklist1Id: string, checklist2Id: string) => void;
  onViewPdf: (pdf: any) => void;
  onDownloadPdf: (pdf: any) => void;
  getAssigneeName: (userId: string) => string;
  getOutcomeName: (outcomeId: string) => string | null;
}
/* eslint-enable no-unused-vars */

export function ReconcileStudyRow({
  study,
  onReconcile,
  onViewPdf,
  onDownloadPdf,
  getAssigneeName,
  getOutcomeName,
}: ReconcileStudyRowProps) {
  const [expanded, setExpanded] = useState(false);

  const sortedPdfs = useMemo(() => sortStudyPdfs(study.pdfs || []), [study.pdfs]);
  const hasPdfs = sortedPdfs.length > 0;
  const citationLine = useMemo(() => getCitationLine(sortedPdfs, study), [sortedPdfs, study]);

  const reconciliationGroups = useMemo(
    () => getReconciliationChecklistsByOutcome(study),
    [study],
  );

  const readyGroups = useMemo(() => {
    const checklists = study.checklists || [];
    return reconciliationGroups.filter((group: any) => {
      if (group.checklists.length !== 2) return false;
      const hasFinalized = checklists.some(
        (c: any) =>
          isReconciledChecklist(c) &&
          c.status === CHECKLIST_STATUS.FINALIZED &&
          c.type === group.type &&
          c.outcomeId === group.outcomeId,
      );
      return !hasFinalized;
    });
  }, [reconciliationGroups, study.checklists]);

  const waitingGroups = useMemo(
    () => reconciliationGroups.filter((g: any) => g.checklists.length === 1),
    [reconciliationGroups],
  );

  const hasReadyPair = readyGroups.length > 0;
  const firstReadyGroup = readyGroups[0] || null;
  const hasMultipleOutcomes = readyGroups.length + waitingGroups.length > 1;

  const getReviewerName = (checklist: any) =>
    checklist.assignedTo ? getAssigneeName(checklist.assignedTo) : 'Unknown';

  const getGroupOutcomeName = (group: any) =>
    group.outcomeId ? getOutcomeName(group.outcomeId) || 'Unknown Outcome' : null;

  const startReconciliation = useCallback(
    (group: any) => {
      if (group.checklists.length === 2) {
        onReconcile(group.checklists[0].id, group.checklists[1].id);
      }
    },
    [onReconcile],
  );

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      if (!hasPdfs) return;
      if ((e.target as HTMLElement).closest('button, [role="button"], [data-selectable]')) return;
      setExpanded(!expanded);
    },
    [hasPdfs, expanded],
  );

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border transition-colors hover:border-border">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        {/* Header */}
        <div
          className={`flex flex-wrap items-center gap-3 px-4 py-3 select-none ${hasPdfs ? 'cursor-pointer' : ''}`}
          onClick={handleRowClick}
        >
          {hasPdfs && (
            <div className="-ml-1 shrink-0 p-1">
              <ChevronRightIcon
                className={`text-muted-foreground/70 h-5 w-5 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <span className="text-foreground truncate font-medium">{study.name}</span>
            {citationLine && (
              <p className="text-muted-foreground w-fit cursor-text truncate text-xs select-text" data-selectable>
                {citationLine}
                {hasPdfs && <span className="text-muted-foreground/70"> -- {sortedPdfs.length} PDFs</span>}
              </p>
            )}
            {!citationLine && hasPdfs && (
              <p className="text-muted-foreground/70 text-xs">{sortedPdfs.length} PDFs</p>
            )}
          </div>

          {/* Single outcome inline */}
          {!hasMultipleOutcomes && (
            <>
              <ReconcileStatusTag study={study} getAssigneeName={getAssigneeName} />

              {firstReadyGroup?.outcomeId && (
                <span className="bg-secondary text-secondary-foreground inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" data-selectable>
                  {getGroupOutcomeName(firstReadyGroup)}
                </span>
              )}

              {hasReadyPair && firstReadyGroup && (
                <div className="text-secondary-foreground flex items-center gap-2 text-sm">
                  <span>{getReviewerName(firstReadyGroup.checklists[0])}</span>
                  <span className="text-muted-foreground/70">vs</span>
                  <span>{getReviewerName(firstReadyGroup.checklists[1])}</span>
                </div>
              )}

              <button
                onClick={e => {
                  e.stopPropagation();
                  if (firstReadyGroup) startReconciliation(firstReadyGroup);
                }}
                disabled={!hasReadyPair}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  hasReadyPair
                    ? 'bg-primary hover:bg-primary/90 text-white'
                    : 'bg-secondary text-muted-foreground cursor-not-allowed'
                }`}
              >
                <GitCompareArrowsIcon className="h-4 w-4" />
                Reconcile
              </button>
            </>
          )}

          {/* Multi-outcome summary badges */}
          {hasMultipleOutcomes && (
            <div className="flex items-center gap-1.5">
              {readyGroups.length > 0 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  {readyGroups.length} ready
                </span>
              )}
              {waitingGroups.length > 0 && (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                  {waitingGroups.length} waiting
                </span>
              )}
            </div>
          )}
        </div>

        {/* Multi-outcome stacked rows */}
        {hasMultipleOutcomes && (
          <div className="px-4 py-3">
            {readyGroups.length > 0 && (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold tracking-wide text-green-700">READY</span>
                  <span className="text-xs text-green-600">({readyGroups.length})</span>
                  <div className="h-px flex-1 bg-green-200" />
                </div>
                <div className="space-y-1">
                  {readyGroups.map((group: any, i: number) => (
                    <div key={group.outcomeId || i} className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50/50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                          {(getChecklistMetadata(group.type) as any)?.name || group.type}
                        </span>
                        {group.outcomeId && (
                          <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                            {getGroupOutcomeName(group)}
                          </span>
                        )}
                        <span className="text-secondary-foreground text-sm">
                          {getReviewerName(group.checklists[0])}{' '}
                          <span className="text-muted-foreground/70">vs</span>{' '}
                          {getReviewerName(group.checklists[1])}
                        </span>
                      </div>
                      <button
                        onClick={() => startReconciliation(group)}
                        className="bg-primary hover:bg-primary/90 flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
                      >
                        <GitCompareArrowsIcon className="h-4 w-4" />
                        Reconcile
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {waitingGroups.length > 0 && (
              <>
                <div className={`mb-1 flex items-center gap-2 ${readyGroups.length > 0 ? 'mt-3' : ''}`}>
                  <span className="text-xs font-semibold tracking-wide text-yellow-700">WAITING</span>
                  <span className="text-xs text-yellow-600">({waitingGroups.length})</span>
                  <div className="h-px flex-1 bg-yellow-200" />
                </div>
                <div className="space-y-1">
                  {waitingGroups.map((group: any, i: number) => (
                    <div key={group.outcomeId || i} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/30 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                          {(getChecklistMetadata(group.type) as any)?.name || group.type}
                        </span>
                        {group.outcomeId && (
                          <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                            {getGroupOutcomeName(group)}
                          </span>
                        )}
                        <span className="text-muted-foreground text-sm">
                          {getReviewerName(group.checklists[0])} -- waiting for second reviewer
                        </span>
                      </div>
                      <span className="bg-secondary text-muted-foreground shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium">
                        Waiting
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* PDFs */}
        <CollapsibleContent>
          {hasPdfs && (
            <div className="border-border space-y-2 border-t px-4 py-3">
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
    </div>
  );
}
