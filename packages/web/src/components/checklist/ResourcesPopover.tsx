import type { ReactNode } from 'react';
import { ExternalLinkIcon } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover';

export interface ChecklistResourceLink {
  title: string;
  description: string;
  url: string;
}

/**
 * Per-tool resource configuration rendered by ResourcesPopover.
 * Defined in each checklist's resources.ts so the appraisal and
 * reconciliation screens share the same links.
 */
export interface ChecklistResources {
  title: string;
  description: string;
  links: ChecklistResourceLink[];
  autoScoringNote?: string;
}

export function ResourcesPopover({
  resources,
  children,
}: {
  resources: ChecklistResources;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className='w-96 p-3'>
        <PopoverHeader>
          <PopoverTitle>{resources.title}</PopoverTitle>
          <PopoverDescription className='text-xs'>{resources.description}</PopoverDescription>
        </PopoverHeader>

        <div className='flex flex-col gap-2'>
          {resources.links.map(link => (
            <ResourceLink
              key={link.url}
              title={link.title}
              description={link.description}
              url={link.url}
            />
          ))}
        </div>

        {resources.autoScoringNote && (
          <p className='text-muted-foreground border-border border-t pt-2 text-xs'>
            {resources.autoScoringNote}
          </p>
        )}
      </PopoverContent>
    </Popover>
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
      className='border-border block rounded-lg border p-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50'
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
