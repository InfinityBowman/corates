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
    <div class='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
      {/* Study Header */}
      <div class='border-b border-gray-200 p-4'>
        <div class='flex items-center justify-between'>
          <div class='flex-1'>
            <h3 class='text-lg font-semibold text-gray-900'>{props.study.name}</h3>
            <Show when={props.study.firstAuthor || props.study.publicationYear}>
              <p class='mt-0.5 text-sm text-gray-600'>
                <span class='font-medium'>{props.study.firstAuthor || 'Unknown'}</span>
                {props.study.publicationYear && ` (${props.study.publicationYear})`}
                <Show when={props.study.journal}>
                  <span class='mx-1'>-</span>
                  <span class='text-gray-500 italic'>{props.study.journal}</span>
                </Show>
              </p>
            </Show>
          </div>
          <div class='flex items-center gap-2'>
            <Show when={hasPdfs()}>
              <button
                onClick={() => props.onViewPdf?.(firstPdf())}
                class='inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100'
                title='View PDF'
              >
                <CgFileDocument class='h-4 w-4' />
                View PDF
              </button>
            </Show>
          </div>
        </div>
      </div>

      {/* Reviewers and Action */}
      <div class='flex items-center justify-between gap-3 bg-gray-50 px-4 py-3'>
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
          class={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            isReady() ?
              'bg-blue-600 text-white hover:bg-blue-700'
            : 'cursor-not-allowed bg-gray-200 text-gray-500'
          }`}
        >
          <BsFileDiff class='h-4 w-4' />
          Reconcile
        </button>
      </div>
    </div>
  );
}
