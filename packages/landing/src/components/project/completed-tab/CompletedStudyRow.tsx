/**
 * CompletedStudyRow - Study row for the completed tab
 * Single-outcome inline, multi-outcome stacked, PDFs expandable.
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { sortStudyPdfs, getCitationLine } from '../study-utils';
import { getChecklistMetadata } from '@/checklist-registry';
import { PdfListItem } from '@/components/pdf/PdfListItem';
import { getCompletedChecklistsByOutcome } from '@/lib/checklist-domain.js';
import { getStatusLabel, getStatusStyle } from '@/constants/checklist-status';
import { PreviousReviewersView } from './PreviousReviewersView';
import { CompletedOutcomeRow } from './CompletedOutcomeRow';

 
interface CompletedStudyRowProps {
  study: any;
  onOpenChecklist: (checklistId: string) => void;
  onViewPdf: (pdf: any) => void;
  onDownloadPdf: (pdf: any) => void;
  getReconciliationProgress: (outcomeId: string | null, type: string) => any;
  getAssigneeName: (userId: string) => string;
  getOutcomeName: (outcomeId: string) => string | null;
}
 

export function CompletedStudyRow({
  study,
  onOpenChecklist,
  onViewPdf,
  onDownloadPdf,
  getReconciliationProgress,
  getAssigneeName,
  getOutcomeName,
}: CompletedStudyRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPreviousReviewers, setShowPreviousReviewers] = useState(false);

  const sortedPdfs = useMemo(() => sortStudyPdfs(study.pdfs || []), [study.pdfs]);
  const hasPdfs = sortedPdfs.length > 0;
  const citationLine = useMemo(() => getCitationLine(sortedPdfs, study), [sortedPdfs, study]);

  const completedOutcomeGroups = useMemo(() => getCompletedChecklistsByOutcome(study), [study]);
  const hasMultipleOutcomes = completedOutcomeGroups.length > 1;
  const firstGroup = completedOutcomeGroups[0];

  const hasPreviousReviewers = useMemo(() => {
    if (!firstGroup) return false;
    const progress = getReconciliationProgress?.(firstGroup.outcomeId, firstGroup.type);
    return !!(progress?.checklist1Id && progress?.checklist2Id);
  }, [firstGroup, getReconciliationProgress]);

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      if (!hasPdfs) return;
      if ((e.target as HTMLElement).closest('button, [role="button"], [data-selectable]')) return;
      setExpanded(!expanded);
    },
    [hasPdfs, expanded],
  );

  return (
    <>
      <div className='border-border bg-card hover:border-border overflow-hidden rounded-lg border transition-colors'>
        <Collapsible open={expanded} onOpenChange={setExpanded}>
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
              <span className='text-foreground truncate font-medium'>{study.name}</span>
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

            {/* Single outcome inline */}
            {!hasMultipleOutcomes && firstGroup && (
              <>
                {firstGroup.outcomeId && (
                  <span
                    className='bg-secondary text-secondary-foreground inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium'
                    data-selectable
                  >
                    {getOutcomeName(firstGroup.outcomeId) || 'Unknown Outcome'}
                  </span>
                )}
                <span
                  className='bg-secondary text-secondary-foreground inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium'
                  data-selectable
                >
                  {(getChecklistMetadata(firstGroup.type) as any)?.name || 'Checklist'}
                </span>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(firstGroup.checklists[0]?.status)}`}
                  data-selectable
                >
                  {getStatusLabel(firstGroup.checklists[0]?.status)}
                </span>
                {hasPreviousReviewers && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setShowPreviousReviewers(true);
                    }}
                    className='bg-secondary text-secondary-foreground hover:bg-secondary/80 shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors'
                  >
                    View Previous
                  </button>
                )}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onOpenChecklist(firstGroup.checklists[0].id);
                  }}
                  className='bg-primary hover:bg-primary/90 shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors'
                >
                  Open
                </button>
              </>
            )}
          </div>

          {/* Multi-outcome stacked */}
          {hasMultipleOutcomes && (
            <div className='divide-border divide-y'>
              {completedOutcomeGroups.map((outcomeGroup: any, i: number) => (
                <CompletedOutcomeRow
                  key={outcomeGroup.outcomeId || i}
                  study={study}
                  outcomeGroup={outcomeGroup}
                  onOpenChecklist={onOpenChecklist}
                  getAssigneeName={getAssigneeName}
                  getOutcomeName={getOutcomeName}
                  getReconciliationProgress={getReconciliationProgress}
                />
              ))}
            </div>
          )}

          {/* PDFs */}
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
      </div>

      {showPreviousReviewers && firstGroup && (
        <PreviousReviewersView
          study={study}
          reconciliationProgress={getReconciliationProgress?.(
            firstGroup.outcomeId,
            firstGroup.type,
          )}
          getAssigneeName={getAssigneeName}
          onClose={() => setShowPreviousReviewers(false)}
        />
      )}
    </>
  );
}
