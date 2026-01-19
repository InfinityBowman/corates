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
    <div class='border-border bg-card overflow-hidden rounded-lg border shadow-sm transition-shadow duration-200 hover:shadow-md'>
      <div class='border-border bg-muted border-b p-4'>
        <div class='flex items-center justify-between gap-3'>
          <div class='min-w-0 flex-1'>
            <h3 class='text-foreground truncate text-lg font-semibold'>{props.study?.name}</h3>
            <Show when={props.study?.firstAuthor || props.study?.publicationYear}>
              <p class='text-secondary-foreground mt-0.5 text-sm'>
                <span class='font-medium'>{props.study?.firstAuthor || 'Unknown'}</span>
                {props.study?.publicationYear && ` (${props.study.publicationYear})`}
                <Show when={props.study?.journal}>
                  <span class='mx-1'>-</span>
                  <span class='text-muted-foreground italic'>{props.study.journal}</span>
                </Show>
              </p>
            </Show>
          </div>

          <div class='flex items-center gap-2'>
            <Show when={hasPdfs()}>
              <button
                onClick={() => props.onViewPdf?.(firstPdf())}
                class='bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors'
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
        fallback={
          <div class='text-muted-foreground/70 p-4 text-center text-sm'>
            No completed checklists
          </div>
        }
      >
        <div class='divide-border divide-y'>
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
