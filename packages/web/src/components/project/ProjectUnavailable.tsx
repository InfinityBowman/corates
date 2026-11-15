import { Link } from '@tanstack/react-router';
import { FolderXIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProjectUnavailableCopy } from '@/project/fatalReasons';

export function ProjectUnavailable({ title, description }: ProjectUnavailableCopy) {
  return (
    <div className='flex flex-1 items-center justify-center p-8'>
      <div className='motion-safe:animate-fade-in-up w-full max-w-md text-center'>
        <div className='border-border bg-card mx-auto mb-6 flex size-12 items-center justify-center rounded-xl border shadow-sm'>
          <FolderXIcon className='text-muted-foreground size-5' aria-hidden='true' />
        </div>
        <h1 className='text-foreground text-2xl font-semibold tracking-tight text-balance'>
          {title}
        </h1>
        <p className='text-muted-foreground mt-3 text-sm text-balance sm:text-base'>
          {description}
        </p>
        <div className='mt-8 flex justify-center'>
          <Button asChild size='lg' className='px-4'>
            <Link to='/dashboard'>Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
