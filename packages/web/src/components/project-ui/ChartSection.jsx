import AMSTARRobvis from '@components/charts/AMSTARRobvis';
import AMSTARDistribution from '@components/charts/AMSTARDistribution';
import ChartSettingsModal from '@components/charts/ChartSettingsModal';
import { getAnswers } from '@/AMSTAR2/checklist.js';
import { createMemo, createSignal, createEffect, Show } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { BiRegularCog } from 'solid-icons/bi';

/**
 * ChartSection - Displays AMSTAR charts for a project's checklists
 *
 * Props:
 * - studies: signal returning array of studies with checklists
 * - members: signal returning array of project members
 * - getChecklistData: function (studyId, checklistId) => checklist with answers
 */
export default function ChartSection(props) {
  const [showSettingsModal, setShowSettingsModal] = createSignal(false);
  const [customLabels, setCustomLabels] = createStore([]);
  const [greyscale, setGreyscale] = createSignal(false);

  const questionOrder = [
    'q1',
    'q2',
    'q3',
    'q4',
    'q5',
    'q6',
    'q7',
    'q8',
    'q9',
    'q10',
    'q11',
    'q12',
    'q13',
    'q14',
    'q15',
    'q16',
  ];

  // Get assignee name from members list
  const getAssigneeName = (userId, membersList) => {
    if (!userId) return 'Unassigned';
    const member = membersList.find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  };

  // Build raw chart data from studies and their checklists
  const rawChecklistData = createMemo(() => {
    const studiesList = props.studies?.() || [];
    const membersList = props.members?.() || [];
    if (studiesList.length === 0) return [];

    const data = [];

    for (const study of studiesList) {
      if (!study.checklists || study.checklists.length === 0) continue;

      for (const checklist of study.checklists) {
        // Get full checklist data with answers
        const fullChecklist = props.getChecklistData?.(study.id, checklist.id);
        if (!fullChecklist?.answers) continue;

        // Get the properly formatted answers using the AMSTAR2 getAnswers function
        const answersObj = getAnswers(fullChecklist.answers);
        if (!answersObj) continue;

        const reviewerName = getAssigneeName(checklist.assignedTo, membersList);

        data.push({
          id: `${study.id}-${checklist.id}`,
          label: `${study.name} - ${reviewerName}`,
          reviewer: reviewerName,
          reviewName: study.name,
          questions: questionOrder.map(q => answersObj[q]),
        });
      }
    }

    return data;
  });

  // Initialize custom labels when raw data changes
  createEffect(() => {
    const raw = rawChecklistData();
    // Only reset if the data structure changed (different ids)
    const currentIds = customLabels.map(l => l.id).join(',');
    const newIds = raw.map(d => d.id).join(',');
    if (currentIds !== newIds) {
      setCustomLabels(raw.map(d => ({ id: d.id, label: d.label })));
    }
  });

  // Merge custom labels with raw data
  const checklistData = createMemo(() => {
    const raw = rawChecklistData();

    return raw.map(item => {
      const customLabel = customLabels.find(l => l.id === item.id);
      return {
        ...item,
        label: customLabel?.label ?? item.label,
      };
    });
  });

  // Update a single label by index
  const handleLabelChange = (index, newValue) => {
    setCustomLabels(index, 'label', newValue);
  };

  return (
    <Show
      when={checklistData().length > 0}
      fallback={
        <div class='text-center py-8 bg-white rounded-lg border border-gray-200'>
          <p class='text-gray-500'>No completed checklists to display charts.</p>
          <p class='text-gray-400 text-sm mt-1'>
            Add studies and complete checklists to see quality assessment charts.
          </p>
        </div>
      }
    >
      <div class='flex flex-col gap-6'>
        {/* Settings button */}
        <div class='flex justify-end'>
          <button
            onClick={() => setShowSettingsModal(true)}
            class='inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors'
            title='Chart Settings'
          >
            <BiRegularCog class='w-4 h-4' />
            Settings
          </button>
        </div>

        <AMSTARRobvis data={checklistData()} greyscale={greyscale()} />
        <AMSTARDistribution data={checklistData()} greyscale={greyscale()} />

        {/* Settings Modal */}
        <ChartSettingsModal
          isOpen={showSettingsModal()}
          onClose={() => setShowSettingsModal(false)}
          labels={customLabels}
          onLabelChange={handleLabelChange}
          greyscale={greyscale()}
          onGreyscaleChange={setGreyscale}
        />
      </div>
    </Show>
  );
}
