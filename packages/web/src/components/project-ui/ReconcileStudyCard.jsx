/**
 * ReconcileStudyCard - Displays a study card specifically for the Ready to Reconcile tab
 * Simplified version focused on reconciliation workflow
 */

import { For, Show, createSignal, createMemo } from 'solid-js';
import { CgFileDocument } from 'solid-icons/cg';
import { BsFileDiff } from 'solid-icons/bs';
import { AiOutlineCheck } from 'solid-icons/ai';

export default function ReconcileStudyCard(props) {
  const [selectedChecklists, setSelectedChecklists] = createSignal([]);

  // Check if study has PDFs
  const hasPdfs = () => props.study.pdfs && props.study.pdfs.length > 0;
  const firstPdf = () => (hasPdfs() ? props.study.pdfs[0] : null);

  // Get completed checklists only
  const completedChecklists = createMemo(() => {
    return (props.study.checklists || []).filter(c => c.status === 'completed');
  });

  // Check if exactly 2 checklists are selected
  const canStartReconcile = createMemo(() => selectedChecklists().length === 2);

  // Toggle checklist selection for reconciliation
  const toggleChecklistSelection = checklistId => {
    setSelectedChecklists(prev => {
      if (prev.includes(checklistId)) {
        return prev.filter(id => id !== checklistId);
      }
      // Only allow max 2 selections
      if (prev.length >= 2) {
        return [prev[1], checklistId];
      }
      return [...prev, checklistId];
    });
  };

  // Start reconciliation with selected checklists
  const startReconciliation = () => {
    if (selectedChecklists().length === 2) {
      props.onReconcile?.(selectedChecklists()[0], selectedChecklists()[1]);
    }
  };

  // Get reviewer name for a checklist
  const getReviewerName = checklist => {
    if (!checklist.assignedTo) return 'Unknown';
    return props.getAssigneeName?.(checklist.assignedTo) || 'Unknown';
  };

  return (
    <div class='bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden'>
      {/* Study Header */}
      <div class='p-4 border-b border-gray-200 bg-purple-50'>
        <div class='flex items-center justify-between'>
          <div class='flex-1'>
            <h3 class='text-lg font-semibold text-gray-900'>{props.study.name}</h3>
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
            <Show when={hasPdfs()}>
              <button
                onClick={() => props.onViewPdf?.(firstPdf())}
                class='inline-flex items-center px-3 py-1.5 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors gap-1.5 border border-gray-200'
                title='View PDF'
              >
                <CgFileDocument class='w-4 h-4' />
                View PDF
              </button>
            </Show>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div class='px-4 py-3 bg-purple-50/50 border-b border-purple-100'>
        <div class='flex items-center gap-2'>
          <BsFileDiff class='w-4 h-4 text-purple-600' />
          <span class='text-sm text-purple-800'>
            Select 2 checklists to compare ({selectedChecklists().length}/2 selected)
          </span>
        </div>
      </div>

      {/* Checklists List */}
      <div class='divide-y divide-gray-200'>
        <For each={completedChecklists()}>
          {checklist => {
            const isSelected = () => selectedChecklists().includes(checklist.id);

            return (
              <div
                class={`p-4 transition-colors flex items-center gap-3 cursor-pointer ${
                  isSelected() ?
                    'bg-purple-50 border-l-4 border-purple-500'
                  : 'hover:bg-purple-50/50 border-l-4 border-transparent'
                }`}
                onClick={() => toggleChecklistSelection(checklist.id)}
              >
                {/* Selection checkbox */}
                <div
                  class={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                    isSelected() ?
                      'bg-purple-600 border-purple-600'
                    : 'border-gray-300 hover:border-purple-400'
                  }`}
                >
                  <Show when={isSelected()}>
                    <AiOutlineCheck class='w-3 h-3 text-white' />
                  </Show>
                </div>

                {/* Checklist info */}
                <div class='flex-1'>
                  <div class='flex items-center gap-3'>
                    <h4 class='text-gray-900 font-medium'>
                      {checklist.type || 'AMSTAR2'} Checklist
                    </h4>
                    <span class='text-sm text-gray-600'>({getReviewerName(checklist)})</span>
                    <span class='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                      completed
                    </span>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Reconcile Action */}
      <div class='p-4 bg-gray-50 border-t border-gray-200'>
        <button
          onClick={startReconciliation}
          disabled={!canStartReconcile()}
          class={`w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
            canStartReconcile() ?
              'bg-purple-600 text-white hover:bg-purple-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <BsFileDiff class='w-4 h-4' />
          Start Reconciliation
        </button>
      </div>
    </div>
  );
}
