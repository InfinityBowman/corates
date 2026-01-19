/**
 * StagedStudiesSection - Unified display of all staged studies from all import sources
 * Shows merged/deduplicated studies ready for submission
 */

import { For, Show } from 'solid-js';
import { BiRegularTrash } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { FiFile } from 'solid-icons/fi';

export default function StagedStudiesSection(props) {
  const studies = () => props.studies;
  const stagedStudies = () => studies().stagedStudiesPreview();

  return (
    <Show when={stagedStudies().length > 0}>
      <div class='border-border mt-4 border-t pt-4'>
        <div class='mb-3 flex items-center justify-between'>
          <h4 class='text-secondary-foreground text-sm font-medium'>
            Staged Studies ({stagedStudies().length})
          </h4>
        </div>

        <div class='space-y-2'>
          <For each={stagedStudies()}>
            {study => (
              <div class='border-border bg-muted flex items-center gap-3 rounded-lg border p-3'>
                <div class='text-muted-foreground shrink-0'>
                  <Show
                    when={study.pdfData || study.googleDriveFileId}
                    fallback={<FiFile class='h-5 w-5' />}
                  >
                    <CgFileDocument class='h-5 w-5' />
                  </Show>
                </div>

                <div class='min-w-0 flex-1'>
                  <p class='text-foreground truncate text-sm font-medium'>{study.title}</p>
                  <div class='text-muted-foreground flex items-center gap-2 text-xs'>
                    <Show when={study.firstAuthor || study.publicationYear}>
                      <span>
                        <Show when={study.firstAuthor}>
                          {study.firstAuthor}
                          <Show when={study.publicationYear}>, </Show>
                        </Show>
                        <Show when={study.publicationYear}>{study.publicationYear}</Show>
                      </span>
                    </Show>
                    <Show when={study.pdfData}>
                      <span class='bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs'>
                        PDF
                      </span>
                    </Show>
                    <Show when={study.googleDriveFileId && !study.pdfData}>
                      <span class='bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs'>
                        Drive
                      </span>
                    </Show>
                  </div>
                </div>

                <button
                  type='button'
                  onClick={() => studies().removeStagedStudy(study)}
                  class='text-muted-foreground/70 focus:ring-primary shrink-0 rounded p-1.5 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:outline-none'
                  title='Remove study'
                >
                  <BiRegularTrash class='h-4 w-4' />
                </button>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}
