/**
 * StudiesExplainer - One-time orientation card above the study list that
 * names the ways studies get into a project. Dismissal is per user, not
 * per project, so a lead with several projects sees it once.
 */

import { useState } from 'react';
import { CloudUploadIcon, FileTextIcon, PaperclipIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, selectUser } from '@/stores/authStore';

const STORAGE_KEY_PREFIX = 'studiesExplainerDismissed:';

function readDismissed(key: string) {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function StudiesExplainer({ onAddStudies }: { onAddStudies: () => void }) {
  const user = useAuthStore(selectUser);
  const storageKey = `${STORAGE_KEY_PREFIX}${user?.id ?? 'anonymous'}`;
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey));

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // Private browsing can refuse writes; the card simply returns next visit.
    }
  };

  return (
    <div className='border-border bg-card mb-4 overflow-hidden rounded-xl border'>
      <div className='bg-muted/50 flex h-10 items-center gap-2.5 border-b px-3.5'>
        <span className='text-sm font-semibold'>Three ways to add studies</span>
        <span className='text-muted-foreground hidden text-xs sm:inline'>
          Shown once. Everything here is also behind the Add studies button.
        </span>
        <Button variant='outline' size='xs' className='ml-auto' onClick={dismiss}>
          Got it
        </Button>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-3'>
        <Way
          icon={<CloudUploadIcon />}
          title='Drop PDFs anywhere on this page'
          body='Drag one or many PDFs from your desktop onto the list. Each becomes a study, with the title, first author, year, and DOI read from the file for you to check before adding.'
        />
        <Way
          icon={<FileTextIcon />}
          title='Import from your reference manager'
          body={
            <>
              Use{' '}
              <button type='button' onClick={onAddStudies} className='text-primary font-medium'>
                Add studies
              </button>{' '}
              to bring in a RIS, EndNote, or BibTeX export, paste a list of DOIs or PubMed IDs, or
              pick PDFs from Google Drive.
            </>
          }
        />
        <Way
          icon={<PaperclipIcon />}
          title='Attach a PDF to a study later'
          body='Expand a study to upload its PDF or import one from Google Drive. Reviewers read it beside the checklist while they appraise.'
        />
      </div>
    </div>
  );
}

function Way({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className='border-border flex min-w-0 flex-col gap-2 border-b p-3.5 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0'>
      <span className='bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg [&_svg]:size-4'>
        {icon}
      </span>
      <p className='text-foreground text-xs font-medium'>{title}</p>
      <p className='text-muted-foreground text-xs'>{body}</p>
    </div>
  );
}
