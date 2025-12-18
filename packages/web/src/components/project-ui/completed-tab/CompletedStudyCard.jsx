/**
 * CompletedStudyCard - Displays a study with its reconciled/consensus checklists
 */

import { For, Show, createMemo } from 'solid-js';
import { CgFileDocument } from 'solid-icons/cg';
import CompletedChecklistRow from './CompletedChecklistRow.jsx';

export default function CompletedStudyCard(props) {
  const hasPdfs = () => props.study?.pdfs && props.study.pdfs.length > 0;
  const firstPdf = () => (hasPdfs() ? props.study.pdfs[0] : null);

  const reconciledChecklists = createMemo(() => {
    return (props.study?.checklists || []).filter(c => c.isReconciled);
  });

  return (
    <div class='bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden'>
      <div class='p-4 border-b border-gray-200 bg-gray-50'>
        <div class='flex items-center justify-between gap-3'>
          <div class='flex-1 min-w-0'>
            <h3 class='text-lg font-semibold text-gray-900 truncate'>{props.study?.name}</h3>
            <Show when={props.study?.firstAuthor || props.study?.publicationYear}>
              <p class='text-sm text-gray-600 mt-0.5'>
                <span class='font-medium'>{props.study?.firstAuthor || 'Unknown'}</span>
                {props.study?.publicationYear && ` (${props.study.publicationYear})`}
                <Show when={props.study?.journal}>
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
                class='inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors gap-1.5'
                title='View PDF'
              >
                <CgFileDocument class='w-4 h-4' />
                View PDF
              </button>
            </Show>
          </div>
        </div>
      </div>

      <Show
        when={reconciledChecklists().length > 0}
        fallback={<div class='p-4 text-center text-gray-400 text-sm'>No reconciled checklists</div>}
      >
        <div class='divide-y divide-gray-200'>
          <For each={reconciledChecklists()}>
            {checklist => (
              <CompletedChecklistRow
                checklist={checklist}
                onOpen={() => props.onOpenChecklist?.(checklist.id)}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
