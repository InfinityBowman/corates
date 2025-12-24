/**
 * CompletedStudyCard - Displays a study with its completed/reconciled checklists
 * For single-reviewer studies: shows completed checklists
 * For dual-reviewer studies: shows reconciled checklists
 */

import { For, Show, createMemo } from 'solid-js';
import { CgFileDocument } from 'solid-icons/cg';
import { getCompletedChecklists } from '@/lib/checklist-domain.js';
import CompletedChecklistRow from './CompletedChecklistRow.jsx';

export default function CompletedStudyCard(props) {
  const hasPdfs = () => props.study?.pdfs && props.study.pdfs.length > 0;
  const firstPdf = () => (hasPdfs() ? props.study.pdfs[0] : null);

  // Get displayable checklists based on reviewer mode
  const displayChecklists = createMemo(() => {
    return getCompletedChecklists(props.study);
  });

  return (
    <div class='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md'>
      <div class='border-b border-gray-200 bg-gray-50 p-4'>
        <div class='flex items-center justify-between gap-3'>
          <div class='min-w-0 flex-1'>
            <h3 class='truncate text-lg font-semibold text-gray-900'>{props.study?.name}</h3>
            <Show when={props.study?.firstAuthor || props.study?.publicationYear}>
              <p class='mt-0.5 text-sm text-gray-600'>
                <span class='font-medium'>{props.study?.firstAuthor || 'Unknown'}</span>
                {props.study?.publicationYear && ` (${props.study.publicationYear})`}
                <Show when={props.study?.journal}>
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
                class='inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200'
                title='View PDF'
              >
                <CgFileDocument class='h-4 w-4' />
                View PDF
              </button>
            </Show>
          </div>
        </div>
      </div>

      <Show
        when={displayChecklists().length > 0}
        fallback={<div class='p-4 text-center text-sm text-gray-400'>No completed checklists</div>}
      >
        <div class='divide-y divide-gray-200'>
          <For each={displayChecklists()}>
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
