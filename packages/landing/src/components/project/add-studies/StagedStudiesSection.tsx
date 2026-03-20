/**
 * StagedStudiesSection - Unified display of all staged studies from all import sources
 * Shows merged/deduplicated studies ready for submission.
 */

import { FileTextIcon, Trash2Icon } from 'lucide-react';

interface StagedStudiesSectionProps {
  studies: any;
}

export function StagedStudiesSection({ studies }: StagedStudiesSectionProps) {
  const stagedStudies = studies.stagedStudiesPreview;

  if (stagedStudies.length === 0) return null;

  return (
    <div className='border-border mt-4 border-t pt-4'>
      <div className='mb-3 flex items-center justify-between'>
        <h4 className='text-secondary-foreground text-sm font-medium'>
          Staged Studies ({stagedStudies.length})
        </h4>
      </div>

      <div className='flex flex-col gap-2'>
        {stagedStudies.map((study: any, index: number) => (
          <div
            key={study.doi || study.title || index}
            className='border-border bg-muted flex items-center gap-3 rounded-lg border p-3'
          >
            <div className='text-muted-foreground shrink-0'>
              <FileTextIcon className='size-5' />
            </div>

            <div className='min-w-0 flex-1'>
              <p className='text-foreground truncate text-sm font-medium'>{study.title}</p>
              <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                {(study.firstAuthor || study.publicationYear) && (
                  <span>
                    {study.firstAuthor}
                    {study.firstAuthor && study.publicationYear && ', '}
                    {study.publicationYear}
                  </span>
                )}
                {study.pdfData && (
                  <span className='bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs'>
                    PDF
                  </span>
                )}
                {study.googleDriveFileId && !study.pdfData && (
                  <span className='bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs'>
                    Drive
                  </span>
                )}
              </div>
            </div>

            <button
              type='button'
              onClick={() => studies.removeStagedStudy(study)}
              className='text-muted-foreground/70 focus:ring-primary shrink-0 rounded p-1.5 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:outline-none'
              title='Remove study'
            >
              <Trash2Icon className='size-4' />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
