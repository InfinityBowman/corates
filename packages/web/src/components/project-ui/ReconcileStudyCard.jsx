/**
 * ReconcileStudyCard - Displays a study card specifically for the Ready to Reconcile tab
 * Shows status tag for waiting/ready state and enables reconciliation when both reviewers complete
 */

import { Show } from 'solid-js';
import { CgFileDocument } from 'solid-icons/cg';
import { BsFileDiff } from 'solid-icons/bs';
import ReconcileStatusTag from './reconcile-tab/ReconcileStatusTag.jsx';

export default function ReconcileStudyCard(props) {
  // Check if study has PDFs
  const hasPdfs = () => props.study.pdfs && props.study.pdfs.length > 0;
  const firstPdf = () => (hasPdfs() ? props.study.pdfs[0] : null);

  // Get the completed checklists
  const completedChecklists = () => {
    return (props.study.checklists || []).filter(c => c.status === 'completed');
  };

  // Check if ready for reconciliation (both checklists completed)
  const isReady = () => completedChecklists().length === 2;

  // Start reconciliation - directly compare the two completed checklists
  const startReconciliation = () => {
    const [checklist1, checklist2] = completedChecklists();
    if (checklist1 && checklist2) {
      props.onReconcile?.(checklist1.id, checklist2.id);
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
      <div class='p-4 border-b border-gray-200'>
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

      {/* Reviewers and Action */}
      <div class='px-4 py-3 flex items-center justify-between gap-3 bg-gray-50'>
        <div class='flex items-center gap-3'>
          <ReconcileStatusTag study={props.study} getAssigneeName={props.getAssigneeName} />
          <Show when={isReady()}>
            <div class='flex items-center gap-2 text-sm text-gray-700'>
              <Show when={completedChecklists()[0]}>
                {checklist => <span>{getReviewerName(checklist())}</span>}
              </Show>
              <span class='text-gray-400'>vs</span>
              <Show when={completedChecklists()[1]}>
                {checklist => <span>{getReviewerName(checklist())}</span>}
              </Show>
            </div>
          </Show>
        </div>
        <button
          onClick={startReconciliation}
          disabled={!isReady()}
          class={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
            isReady() ?
              'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          <BsFileDiff class='w-4 h-4' />
          Reconcile
        </button>
      </div>
    </div>
  );
}
