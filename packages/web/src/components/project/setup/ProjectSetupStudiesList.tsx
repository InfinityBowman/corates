/**
 * Studies already added to the project during setup, each removable.
 */

import { Trash2Icon } from 'lucide-react';
import type { StudyInfo } from '@/stores/projectStore';
import { Button } from '@/components/ui/button';
import { project } from '@/project';
import { getCitationLine, sortStudyPdfs } from '../study-utils';

interface ProjectSetupStudiesListProps {
  studies: StudyInfo[];
}

export function ProjectSetupStudiesList({ studies }: ProjectSetupStudiesListProps) {
  if (studies.length === 0) return null;

  return (
    <div className='border-border mt-6 overflow-hidden rounded-xl border'>
      <div className='bg-muted/30 text-muted-foreground border-b px-4 py-2.5 text-[11px] font-bold tracking-[0.06em] uppercase'>
        {studies.length} {studies.length === 1 ? 'study' : 'studies'} added
      </div>
      <ul className='max-h-[min(360px,40vh)] overflow-y-auto'>
        {studies.map(study => {
          const sortedPdfs = sortStudyPdfs(study.pdfs || []);
          const citation = getCitationLine(sortedPdfs, study);
          return (
            <li
              key={study.id}
              className='flex items-center gap-3 border-b px-4 py-3 last:border-b-0'
            >
              <div className='min-w-0 flex-1'>
                <div className='truncate text-sm font-semibold'>{study.name}</div>
                <div className='text-muted-foreground mt-0.5 text-xs'>
                  {citation}
                  {citation && sortedPdfs.length === 0 && ' | '}
                  {sortedPdfs.length === 0 && (
                    <span className='font-semibold text-amber-700'>no PDF</span>
                  )}
                </div>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                className='text-muted-foreground hover:text-destructive'
                aria-label={`Remove ${study.name}`}
                onClick={() => void project.study.delete(study.id)}
              >
                <Trash2Icon />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
