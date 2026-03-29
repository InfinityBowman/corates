/**
 * IntegrationsSettings - Third-party integrations and about section
 */

import { LinkIcon, InfoIcon } from 'lucide-react';
import { GoogleDriveSettings } from './GoogleDriveSettings';

export function IntegrationsSettings() {
  return (
    <div className='bg-background min-h-full py-8'>
      <div className='mx-auto max-w-3xl px-4 sm:px-6'>
        <div className='mb-8'>
          <h1 className='text-foreground text-2xl font-semibold tracking-tight'>Integrations</h1>
          <p className='text-muted-foreground mt-1'>
            Connect third-party services to enhance your workflow
          </p>
        </div>

        {/* Google Drive Section */}
        <div className='border-border/60 bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div className='border-border bg-primary/5 border-b px-6 py-4'>
            <div className='flex items-center gap-2.5'>
              <div className='bg-primary/15 flex size-8 items-center justify-center rounded-lg'>
                <LinkIcon className='text-primary size-4' />
              </div>
              <div>
                <h2 className='text-foreground text-base font-semibold'>Cloud Storage</h2>
                <p className='text-muted-foreground text-sm'>
                  Import PDFs directly from cloud storage providers
                </p>
              </div>
            </div>
          </div>
          <div className='p-6'>
            <GoogleDriveSettings />
          </div>
        </div>

        {/* About Section */}
        <div className='border-border/60 bg-card overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div className='border-border from-muted/50 to-background border-b bg-gradient-to-r px-6 py-4'>
            <div className='flex items-center gap-2.5'>
              <div className='bg-secondary flex size-8 items-center justify-center rounded-lg'>
                <InfoIcon className='text-secondary-foreground size-4' />
              </div>
              <h2 className='text-foreground text-base font-semibold'>About</h2>
            </div>
          </div>
          <div className='p-6'>
            <div className='text-secondary-foreground flex flex-col gap-2 text-sm'>
              <p>
                <span className='text-foreground font-medium'>CoRATES</span> - Collaborative
                Research Appraisal Tool for Evidence Synthesis
              </p>
              <p className='text-muted-foreground'>Version 1.0.0</p>
              <p className='pt-2'>
                <a
                  href='/'
                  className='text-primary hover:text-primary/80 transition-colors hover:underline'
                >
                  Visit our website
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
