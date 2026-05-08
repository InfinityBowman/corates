/**
 * PreviousReviewersView - Dialog to display original reviewer checklists
 *
 * Shows the checklists from each reviewer that were reconciled to create the final version.
 * Displays checklists in readonly mode with tabs to switch between reviewers.
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getOriginalReviewerChecklists } from '@corates/shared/checklists';
import { getChecklistMetadata } from '@/checklist-registry/index';
import { GenericChecklist } from '@/components/checklist/GenericChecklist';
import type { StudyInfo } from '@/stores/projectStore';
import type { ReconciliationProgressEntry } from '@/primitives/useProject/reconciliation';

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
  const [activeTab, setActiveTab] = useState('reviewer1');

  const originalChecklists = useMemo(() => {
    if (!study || !reconciliationProgress) return [];
    return getOriginalReviewerChecklists(study, reconciliationProgress);
  }, [study, reconciliationProgress]);

  const reviewerTabs = useMemo(() => {
    return originalChecklists.map((cl, i) => ({
      value: `reviewer${i + 1}`,
      label: getAssigneeName(String(cl.assignedTo ?? '')),
      checklistId: cl.id,
      type: cl.type,
    }));
  }, [originalChecklists, getAssigneeName]);

  const currentTab = reviewerTabs.find(t => t.value === activeTab) ?? reviewerTabs[0] ?? null;

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
          {reviewerTabs.length > 0 ?
            <>
              {reviewerTabs.length > 1 && (
                <div className='mb-4'>
                  <Tabs value={currentTab?.value ?? activeTab} onValueChange={v => setActiveTab(v)}>
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

              {currentTab && (
                <div className='border-border bg-card flex-1 overflow-y-auto rounded-lg border p-6'>
                  <div className='border-border mb-4 border-b pb-3'>
                    <div className='flex items-center justify-between'>
                      <h3 className='text-foreground text-base font-semibold'>
                        {currentTab.label || 'Reviewer'}
                      </h3>
                      <span className='text-muted-foreground text-sm'>
                        {getChecklistMetadata(currentTab.type).name}
                      </span>
                    </div>
                  </div>
                  <GenericChecklist
                    studyId={study.id}
                    checklistId={currentTab.checklistId}
                    checklistType={currentTab.type}
                    readOnly={true}
                  />
                </div>
              )}
            </>
          : <div className='flex flex-1 items-center justify-center py-16'>
              <div className='text-muted-foreground text-center'>
                No previous reviewer appraisals found.
              </div>
            </div>
          }
        </div>
      </DialogContent>
    </Dialog>
  );
}
