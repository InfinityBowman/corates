import { ExternalLinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export interface ChecklistResourceLink {
  title: string;
  description: string;
  url: string;
}

/**
 * Per-tool resource configuration rendered by ResourcesDialog.
 * Defined in each checklist's resources.ts so the appraisal and
 * reconciliation screens share the same links.
 */
export interface ChecklistResources {
  title: string;
  description: string;
  links: ChecklistResourceLink[];
  autoScoringNote?: string;
}

export function ResourcesDialog({
  open,
  onClose,
  resources,
}: {
  open: boolean;
  onClose: () => void;
  resources: ChecklistResources;
}) {
  return (
    <Dialog open={open} onOpenChange={openState => !openState && onClose()}>
      <DialogContent className='max-h-[85vh] max-w-md overflow-auto'>
        <DialogHeader>
          <DialogTitle>{resources.title}</DialogTitle>
          <DialogDescription>{resources.description}</DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4 py-4'>
          {resources.links.map(link => (
            <ResourceLink
              key={link.url}
              title={link.title}
              description={link.description}
              url={link.url}
            />
          ))}
          {resources.autoScoringNote && (
            <div className='bg-muted rounded-lg p-3'>
              <h4 className='text-secondary-foreground text-sm font-medium'>About Auto Scoring</h4>
              <p className='text-muted-foreground mt-1 text-xs'>{resources.autoScoringNote}</p>
            </div>
          )}
        </div>

        <div className='border-border border-t pt-3'>
          <Button variant='secondary' className='w-full' onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResourceLink({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return (
    <a
      href={url}
      target='_blank'
      rel='noopener noreferrer'
      className='border-border block rounded-lg border p-3 transition-colors hover:border-blue-300 hover:bg-blue-50'
    >
      <div className='flex items-start justify-between gap-2'>
        <div>
          <h4 className='text-foreground text-sm font-medium'>{title}</h4>
          <p className='text-muted-foreground mt-0.5 text-xs'>{description}</p>
        </div>
        <ExternalLinkIcon className='text-muted-foreground/70 mt-0.5 size-3.5 shrink-0' />
      </div>
    </a>
  );
}
