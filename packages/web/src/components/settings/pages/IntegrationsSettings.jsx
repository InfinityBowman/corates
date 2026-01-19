/**
 * IntegrationsSettings - Third-party integrations and about section
 * Includes: Google Drive, About info
 */

import { FiLink, FiInfo } from 'solid-icons/fi';
import { LANDING_URL } from '@config/api.js';
import GoogleDriveSettings from '@/components/settings/pages/GoogleDriveSettings.jsx';

export default function IntegrationsSettings() {
  return (
    <div class='bg-background min-h-full py-8'>
      <div class='mx-auto max-w-3xl px-4 sm:px-6'>
        <div class='mb-8'>
          <h1 class='text-foreground text-2xl font-semibold tracking-tight'>Integrations</h1>
          <p class='text-muted-foreground mt-1'>
            Connect third-party services to enhance your workflow
          </p>
        </div>

        {/* Google Drive Section */}
        <div class='border-border bg-card mb-6 overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-border-subtle border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='bg-primary-subtle flex h-8 w-8 items-center justify-center rounded-lg'>
                <FiLink class='text-primary h-4 w-4' />
              </div>
              <div>
                <h2 class='text-foreground text-base font-semibold'>Cloud Storage</h2>
                <p class='text-muted-foreground text-sm'>
                  Import PDFs directly from cloud storage providers
                </p>
              </div>
            </div>
          </div>
          <div class='p-6'>
            <GoogleDriveSettings />
          </div>
        </div>

        {/* About Section */}
        <div class='border-border bg-card overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-border-subtle border-b bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='bg-secondary flex h-8 w-8 items-center justify-center rounded-lg'>
                <FiInfo class='text-secondary-foreground h-4 w-4' />
              </div>
              <h2 class='text-foreground text-base font-semibold'>About</h2>
            </div>
          </div>
          <div class='p-6'>
            <div class='text-secondary-foreground space-y-2 text-sm'>
              <p>
                <span class='text-foreground font-medium'>CoRATES</span> - Collaborative Research
                Appraisal Tool for Evidence Synthesis
              </p>
              <p class='text-muted-foreground'>Version 1.0.0</p>
              <p class='pt-2'>
                <a
                  href={LANDING_URL}
                  class='text-primary hover:text-primary/80 transition-colors hover:underline'
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
