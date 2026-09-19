/**
 * StagedStudiesSection - Unified display of all staged studies from all import sources
 * Shows merged/deduplicated studies ready for submission.
 */

import type { ReactNode } from 'react';
import { FileTextIcon, Trash2Icon, CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { describeMatch } from '@/hooks/useAddStudies/existing';
import type { StagedStudy } from '@/hooks/useAddStudies';

interface StagedStudiesSectionProps {
  studies: any;
  /** Rendered in the header row, beside the count. */
  actions?: ReactNode;
  /** Sheet only - the inline card would pin behind the sticky project header. */
  stickyHeader?: boolean;
}

export function StagedStudiesSection({
  studies,
  actions,
  stickyHeader = false,
}: StagedStudiesSectionProps) {
  const stagedStudies: StagedStudy[] = studies.stagedStudiesPreview;

  if (stagedStudies.length === 0) return null;

  return (
    <div className='border-border mt-4 border-t pt-4'>
      <div
        className={cn(
          'mb-3 flex items-center justify-between gap-3',
          stickyHeader && 'bg-background sticky top-0 z-10 py-2',
        )}
      >
        <h4 className='text-secondary-foreground text-sm font-medium'>
          Ready to add ({studies.submittableCount})
          {studies.flaggedCount > 0 && (
            <span className='text-muted-foreground font-normal'>
              {' '}
              &middot; {studies.flaggedCount} already in this project
            </span>
          )}
        </h4>
        {actions}
      </div>

      <div className='flex flex-col gap-2'>
        {stagedStudies.map(study => {
          const flagged = study.existingMatch !== null;
          const included = studies.isSubmittable(study);
          const sourceCount = study.sources.length;
          // Only the study's own details dim while it sits out; a dimmed parent would take
          // the buttons with it and Add anyway would read as disabled.
          const dimmed = flagged && !included;

          return (
            <div
              key={study.key}
              className='border-border bg-muted flex items-center gap-3 rounded-lg border p-3'
              data-testid='staged-study'
            >
              <div className={cn('text-muted-foreground shrink-0', dimmed && 'opacity-60')}>
                <FileTextIcon className='size-5' />
              </div>

              <div className='min-w-0 flex-1'>
                <p
                  className={cn(
                    'text-foreground truncate text-sm font-medium',
                    dimmed && 'opacity-60',
                  )}
                >
                  {study.title}
                </p>
                <div
                  className={cn(
                    'text-muted-foreground flex flex-wrap items-center gap-2 text-xs',
                    dimmed && 'opacity-60',
                  )}
                >
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
                  {study.extraPdfs.length > 0 && (
                    <span className='bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs'>
                      +{study.extraPdfs.length} PDF
                    </span>
                  )}
                  {study.googleDriveFileId && !study.pdfData && (
                    <span className='bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs'>
                      Drive
                    </span>
                  )}
                  {sourceCount > 1 && <span>Merged from {sourceCount} sources</span>}
                  {study.conflictingFields.length > 0 && (
                    <span title='The merge kept one value for each of these.'>
                      Sources disagree on {study.conflictingFields.join(', ')}
                    </span>
                  )}
                </div>

                {study.existingMatch && (
                  <div className='mt-1.5 flex flex-wrap items-center gap-2 text-xs'>
                    <span className='flex max-w-full min-w-0 items-center gap-1 text-amber-700 dark:text-amber-500'>
                      <CopyIcon className='size-3.5 shrink-0' />
                      <span className='shrink-0'>{describeMatch(study.existingMatch)}:</span>
                      <span className='truncate font-medium'>{study.existingMatch.studyTitle}</span>
                    </span>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-6 px-2 text-xs'
                      onClick={() => studies.toggleDuplicateConfirmed(study.key)}
                      data-testid='staged-study-add-anyway'
                    >
                      {included ? 'Undo add' : 'Add anyway'}
                    </Button>
                  </div>
                )}
              </div>

              <Button
                variant='ghost'
                size='icon-sm'
                onClick={() => studies.removeStagedStudy(study)}
                className='text-muted-foreground shrink-0 hover:text-red-600'
                title='Remove study'
                aria-label='Remove study'
              >
                <Trash2Icon className='size-4' />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
