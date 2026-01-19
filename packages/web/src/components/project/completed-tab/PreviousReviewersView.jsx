/**
 * PreviousReviewersView - Dialog to display original reviewer checklists
 *
 * Shows the checklists from each reviewer that were reconciled to create the final version.
 * Displays checklists in readonly mode with tabs to switch between reviewers.
 */

import { Show, For, createMemo, createSignal, createEffect } from 'solid-js';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { FiX } from 'solid-icons/fi';
import { useProjectContext } from '@/components/project/ProjectContext.jsx';
import useProject from '@/primitives/useProject/index.js';
import { getOriginalReviewerChecklists } from '@/lib/checklist-domain.js';
import { getChecklistMetadata } from '@/checklist-registry';
import GenericChecklist from '@/components/checklist/GenericChecklist.jsx';

export default function PreviousReviewersView(props) {
  // props.study: Study object
  // props.reconciliationProgress: Object with checklist1Id and checklist2Id
  // props.getAssigneeName: (userId) => string
  // props.onClose: () => void

  const { projectId } = useProjectContext();
  const { getChecklistData, getQuestionNote } = useProject(projectId);

  const [checklist1Data, setChecklist1Data] = createSignal(null);
  const [checklist2Data, setChecklist2Data] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [activeTab, setActiveTab] = createSignal('reviewer1');

  // Get original reviewer checklists
  const originalChecklists = createMemo(() => {
    if (!props.study || !props.reconciliationProgress) return [];
    return getOriginalReviewerChecklists(props.study, props.reconciliationProgress);
  });

  // Load checklist data
  createEffect(() => {
    const checklists = originalChecklists();
    if (checklists.length === 0) {
      setLoading(false);
      setChecklist1Data(null);
      setChecklist2Data(null);
      return;
    }

    setLoading(true);

    try {
      // Load data for both checklists (synchronous)
      const data1 = checklists[0] ? getChecklistData(props.study.id, checklists[0].id) : null;
      const data2 = checklists[1] ? getChecklistData(props.study.id, checklists[1].id) : null;

      if (data1) {
        setChecklist1Data({
          id: checklists[0].id,
          name: props.study?.name || 'Checklist',
          reviewerName: props.getAssigneeName(checklists[0].assignedTo),
          createdAt: checklists[0].createdAt,
          type: checklists[0].type,
          ...data1.answers,
        });
      } else {
        setChecklist1Data(null);
      }

      if (data2) {
        setChecklist2Data({
          id: checklists[1].id,
          name: props.study?.name || 'Checklist',
          reviewerName: props.getAssigneeName(checklists[1].assignedTo),
          createdAt: checklists[1].createdAt,
          type: checklists[1].type,
          ...data2.answers,
        });
      } else {
        setChecklist2Data(null);
      }
    } catch (err) {
      console.error('Failed to load checklist data:', err);
      setChecklist1Data(null);
      setChecklist2Data(null);
    } finally {
      setLoading(false);
    }
  });

  const checklists = () => originalChecklists();
  const hasData = () => !loading() && (checklist1Data() || checklist2Data());

  // Build tabs for reviewers
  const reviewerTabs = createMemo(() => {
    const tabs = [];
    const lists = checklists();

    if (lists[0] && checklist1Data()) {
      tabs.push({
        value: 'reviewer1',
        label: props.getAssigneeName(lists[0].assignedTo),
      });
    }

    if (lists[1] && checklist2Data()) {
      tabs.push({
        value: 'reviewer2',
        label: props.getAssigneeName(lists[1].assignedTo),
      });
    }

    return tabs;
  });

  // Get current checklist data based on active tab
  const currentChecklistData = createMemo(() => {
    if (activeTab() === 'reviewer1') return checklist1Data();
    if (activeTab() === 'reviewer2') return checklist2Data();
    return null;
  });

  const currentChecklistType = createMemo(() => {
    const lists = checklists();
    if (activeTab() === 'reviewer1' && lists[0]) return lists[0].type;
    if (activeTab() === 'reviewer2' && lists[1]) return lists[1].type;
    return null;
  });

  const currentChecklistId = createMemo(() => {
    const lists = checklists();
    if (activeTab() === 'reviewer1' && lists[0]) return lists[0].id;
    if (activeTab() === 'reviewer2' && lists[1]) return lists[1].id;
    return null;
  });

  // Set default tab when data loads
  createEffect(() => {
    if (!loading() && reviewerTabs().length > 0 && !currentChecklistData()) {
      setActiveTab(reviewerTabs()[0].value);
    }
  });

  return (
    <Dialog
      open={true}
      onOpenChange={open => {
        if (!open) {
          props.onClose();
        }
      }}
    >
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent class='max-w-4xl'>
          <DialogHeader>
            <div>
              <DialogTitle>Original Reviewer Appraisals</DialogTitle>
              <DialogDescription>
                The original appraisals from each reviewer that were reconciled to create the final
                version.
              </DialogDescription>
            </div>
            <DialogCloseTrigger>
              <FiX class='h-5 w-5' />
            </DialogCloseTrigger>
          </DialogHeader>
          <DialogBody>
            <div class='flex flex-col' style={{ 'min-height': '600px', 'max-height': '70vh' }}>
              <Show
                when={hasData()}
                fallback={
                  <div class='flex flex-1 items-center justify-center py-16'>
                    <div class='text-muted-foreground text-center'>
                      {loading() ?
                        'Loading appraisals...'
                      : 'No previous reviewer appraisals found.'}
                    </div>
                  </div>
                }
              >
                <Show when={reviewerTabs().length > 1}>
                  <div class='mb-4'>
                    <Tabs value={activeTab()} onValueChange={setActiveTab}>
                      <TabsList class='border-border bg-card overflow-x-auto rounded-t-lg border'>
                        <For each={reviewerTabs()}>
                          {tab => (
                            <TabsTrigger
                              value={tab.value}
                              class='text-secondary-foreground hover:bg-muted hover:text-foreground data-[selected]:text-foreground gap-2 border-b-2 border-transparent data-[selected]:border-blue-600'
                            >
                              {tab.label}
                            </TabsTrigger>
                          )}
                        </For>
                      </TabsList>
                    </Tabs>
                  </div>
                </Show>

                <div class='border-border bg-card flex-1 overflow-y-auto rounded-lg border p-6'>
                  <Show when={currentChecklistData()}>
                    <div class='border-border mb-4 border-b pb-3'>
                      <div class='flex items-center justify-between'>
                        <h3 class='text-foreground text-base font-semibold'>
                          {currentChecklistData()?.reviewerName || 'Reviewer'}
                        </h3>
                        <span class='text-muted-foreground text-sm'>
                          {currentChecklistType() ?
                            getChecklistMetadata(currentChecklistType())?.name ||
                            currentChecklistType()
                          : ''}
                        </span>
                      </div>
                    </div>
                    <GenericChecklist
                      checklist={currentChecklistData()}
                      checklistType={currentChecklistType()}
                      readOnly={true}
                      onUpdate={() => {}}
                      getQuestionNote={questionKey => {
                        const checklistId = currentChecklistId();
                        if (!checklistId) return null;
                        return getQuestionNote(props.study.id, checklistId, questionKey);
                      }}
                    />
                  </Show>
                </div>
              </Show>
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPositioner>
    </Dialog>
  );
}
