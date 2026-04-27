/**
 * PreviousReviewersView - Dialog to display original reviewer checklists
 *
 * Shows the checklists from each reviewer that were reconciled to create the final version.
 * Displays checklists in readonly mode with tabs to switch between reviewers.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectContext } from '@/components/project/ProjectContext';
import { connectionPool } from '@/project/ConnectionPool';
import { getOriginalReviewerChecklists } from '@corates/shared/checklists';
import { getChecklistMetadata } from '@/checklist-registry/index';
import { GenericChecklist } from '@/components/checklist/GenericChecklist';
import type { StudyInfo } from '@/stores/projectStore';
import type { ReconciliationProgressEntry } from '@/primitives/useProject/reconciliation';

interface ReviewerChecklistData {
  id: string;
  name: string;
  reviewerName: string;
  createdAt?: number | string;
  type: string;
  [key: string]: unknown;
}

interface PreviousReviewersViewProps {
  study: StudyInfo;
  reconciliationProgress: ReconciliationProgressEntry | null;
  getAssigneeName: (_userId: string) => string;
  onClose: () => void;
}

export function PreviousReviewersView({
  study,
  reconciliationProgress,
  getAssigneeName,
  onClose,
}: PreviousReviewersViewProps) {
  const { projectId } = useProjectContext();
  const ops = connectionPool.getOps(projectId);
  if (!ops) throw new Error(`No connection for project ${projectId}`);
  const getChecklistData = ops.checklist.getChecklistData;
  const getTextRef = ops.checklist.getTextRef;

  const [checklist1Data, setChecklist1Data] = useState<ReviewerChecklistData | null>(null);
  const [checklist2Data, setChecklist2Data] = useState<ReviewerChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reviewer1');

  // Get original reviewer checklists
  const originalChecklists = useMemo(() => {
    if (!study || !reconciliationProgress) return [];
    return getOriginalReviewerChecklists(study, reconciliationProgress);
  }, [study, reconciliationProgress]);

  // Load checklist data
  useEffect(() => {
    if (originalChecklists.length === 0) {
      setLoading(false);
      setChecklist1Data(null);
      setChecklist2Data(null);
      return;
    }

    setLoading(true);

    try {
      const data1 =
        originalChecklists[0] ? getChecklistData(study.id, originalChecklists[0].id) : null;
      const data2 =
        originalChecklists[1] ? getChecklistData(study.id, originalChecklists[1].id) : null;

      setChecklist1Data(
        data1 ?
          {
            id: originalChecklists[0].id,
            name: study?.name || 'Checklist',
            reviewerName: getAssigneeName(String(originalChecklists[0].assignedTo ?? '')),
            createdAt: originalChecklists[0].createdAt,
            type: originalChecklists[0].type,
            ...(data1.answers ?? {}),
          }
        : null,
      );

      setChecklist2Data(
        data2 ?
          {
            id: originalChecklists[1].id,
            name: study?.name || 'Checklist',
            reviewerName: getAssigneeName(String(originalChecklists[1].assignedTo ?? '')),
            createdAt: originalChecklists[1].createdAt,
            type: originalChecklists[1].type,
            ...(data2.answers ?? {}),
          }
        : null,
      );
    } catch (err) {
      import('@/lib/error-utils').then(({ handleError }) =>
        handleError(err, { toastTitle: 'Load Failed' }),
      );
      setChecklist1Data(null);
      setChecklist2Data(null);
    } finally {
      setLoading(false);
    }
  }, [originalChecklists, study, getChecklistData, getAssigneeName]);

  const hasData = !loading && (checklist1Data || checklist2Data);

  // Build tabs for reviewers
  const reviewerTabs = useMemo(() => {
    const tabs: Array<{ value: string; label: string }> = [];
    if (originalChecklists[0] && checklist1Data) {
      tabs.push({
        value: 'reviewer1',
        label: getAssigneeName(String(originalChecklists[0].assignedTo ?? '')),
      });
    }
    if (originalChecklists[1] && checklist2Data) {
      tabs.push({
        value: 'reviewer2',
        label: getAssigneeName(String(originalChecklists[1].assignedTo ?? '')),
      });
    }
    return tabs;
  }, [originalChecklists, checklist1Data, checklist2Data, getAssigneeName]);

  // Get current checklist data based on active tab
  const currentChecklistData = activeTab === 'reviewer1' ? checklist1Data : checklist2Data;

  const currentChecklistType = useMemo(() => {
    if (activeTab === 'reviewer1' && originalChecklists[0]) return originalChecklists[0].type;
    if (activeTab === 'reviewer2' && originalChecklists[1]) return originalChecklists[1].type;
    return null;
  }, [activeTab, originalChecklists]);

  const currentChecklistId = useMemo(() => {
    if (activeTab === 'reviewer1' && originalChecklists[0]) return originalChecklists[0].id;
    if (activeTab === 'reviewer2' && originalChecklists[1]) return originalChecklists[1].id;
    return null;
  }, [activeTab, originalChecklists]);

  // Set default tab when data loads
  useEffect(() => {
    if (!loading && reviewerTabs.length > 0 && !currentChecklistData) {
      setActiveTab(reviewerTabs[0].value);
    }
  }, [loading, reviewerTabs, currentChecklistData]);

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle>Original Reviewer Appraisals</DialogTitle>
          <DialogDescription>
            The original appraisals from each reviewer that were reconciled to create the final
            version.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col' style={{ minHeight: '600px', maxHeight: '70vh' }}>
          {hasData ?
            <>
              {reviewerTabs.length > 1 && (
                <div className='mb-4'>
                  <Tabs value={activeTab} onValueChange={v => setActiveTab(v)}>
                    <TabsList className='border-border bg-card overflow-x-auto rounded-t-lg border'>
                      {reviewerTabs.map(tab => (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className='text-secondary-foreground hover:bg-muted hover:text-foreground data-[state=active]:text-foreground gap-2 border-b-2 border-transparent data-[state=active]:border-blue-600'
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}

              <div className='border-border bg-card flex-1 overflow-y-auto rounded-lg border p-6'>
                {currentChecklistData && (
                  <>
                    <div className='border-border mb-4 border-b pb-3'>
                      <div className='flex items-center justify-between'>
                        <h3 className='text-foreground text-base font-semibold'>
                          {currentChecklistData.reviewerName || 'Reviewer'}
                        </h3>
                        <span className='text-muted-foreground text-sm'>
                          {currentChecklistType ?
                            getChecklistMetadata(currentChecklistType).name
                          : ''}
                        </span>
                      </div>
                    </div>
                    <GenericChecklist
                      checklist={currentChecklistData}
                      checklistType={currentChecklistType ?? undefined}
                      readOnly={true}
                      onUpdate={() => {}}
                      getTextRef={ref => {
                        if (!currentChecklistId) return null;
                        return getTextRef(study.id, currentChecklistId, ref);
                      }}
                    />
                  </>
                )}
              </div>
            </>
          : <div className='flex flex-1 items-center justify-center py-16'>
              <div className='text-muted-foreground text-center'>
                {loading ? 'Loading appraisals...' : 'No previous reviewer appraisals found.'}
              </div>
            </div>
          }
        </div>
      </DialogContent>
    </Dialog>
  );
}
