/**
 * IntegrationsSettings - Third-party integrations and about section
 * Includes: Google Drive, About info
 */

import { FiLink, FiInfo } from 'solid-icons/fi';
import { LANDING_URL } from '@config/api.js';
import GoogleDriveSettings from '@/components/settings/pages/GoogleDriveSettings.jsx';

export default function IntegrationsSettings() {
  return (
    <div class='min-h-full bg-gradient-to-br from-slate-50 to-slate-100/80 py-8'>
      <div class='mx-auto max-w-3xl px-4 sm:px-6'>
        <div class='mb-8'>
          <h1 class='text-2xl font-semibold tracking-tight text-slate-900'>Integrations</h1>
          <p class='mt-1 text-slate-500'>Connect third-party services to enhance your workflow</p>
        </div>

        {/* Google Drive Section */}
        <div class='mb-6 overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50'>
                <FiLink class='h-4 w-4 text-blue-600' />
              </div>
              <div>
                <h2 class='text-base font-semibold text-slate-900'>Cloud Storage</h2>
                <p class='text-sm text-slate-500'>
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
        <div class='overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md'>
          <div class='border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4'>
            <div class='flex items-center space-x-2.5'>
              <div class='flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100'>
                <FiInfo class='h-4 w-4 text-slate-600' />
              </div>
              <h2 class='text-base font-semibold text-slate-900'>About</h2>
            </div>
          </div>
          <div class='p-6'>
            <div class='space-y-2 text-sm text-slate-600'>
              <p>
                <span class='font-medium text-slate-900'>CoRATES</span> - Collaborative Research
                Appraisal Tool for Evidence Synthesis
              </p>
              <p class='text-slate-500'>Version 1.0.0</p>
              <p class='pt-2'>
                <a
                  href={LANDING_URL}
                  class='text-blue-600 transition-colors hover:text-blue-700 hover:underline'
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
