/**
 * The studies already in the project, shown under the setup import form.
 */

import { FileTextIcon } from 'lucide-react';
import type { StudyInfo } from '@/stores/projectStore';

interface ProjectSetupStudiesListProps {
  studies: StudyInfo[];
}

export function ProjectSetupStudiesList({ studies }: ProjectSetupStudiesListProps) {
  if (studies.length === 0) return null;

  return (
    <section aria-labelledby='setup-studies-heading'>
      <h3 id='setup-studies-heading' className='text-foreground text-sm font-semibold'>
        {studies.length === 1 ? '1 study added' : `${studies.length} studies added`}
      </h3>
      <ul className='border-border bg-card mt-3 divide-y rounded-xl border'>
        {studies.map(study => {
          const byline = [study.firstAuthor, study.publicationYear].filter(Boolean).join(', ');
          return (
            <li key={study.id} className='flex items-start gap-3 px-4 py-3'>
              <FileTextIcon className='text-muted-foreground mt-0.5 size-4 shrink-0' />
              <div className='min-w-0'>
                <p className='text-foreground truncate text-sm font-medium'>{study.name}</p>
                {byline && <p className='text-muted-foreground text-xs'>{byline}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
