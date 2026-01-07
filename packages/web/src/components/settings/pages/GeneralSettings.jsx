/**
 * GeneralSettings - General/About section extracted from SettingsPage
 * Includes: Integrations (Google Drive), About info
 */

import { FiLink, FiInfo } from 'solid-icons/fi';
import { LANDING_URL } from '@config/api.js';
import GoogleDriveSettings from '@/components/settings/pages/GoogleDriveSettings.jsx';

export default function GeneralSettings() {
  return (
    <div class='min-h-full bg-blue-50 py-6'>
      <div class='mx-auto max-w-3xl px-4 sm:px-6'>
        <h1 class='mb-6 text-2xl font-bold text-gray-900'>General</h1>

        {/* Integrations Section */}
        <div class='mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
          <div class='border-b border-gray-200 bg-gray-50 px-6 py-4'>
            <div class='flex items-center space-x-2'>
              <FiLink class='h-5 w-5 text-gray-600' />
              <h2 class='text-lg font-medium text-gray-900'>Integrations</h2>
            </div>
            <p class='mt-1 text-sm text-gray-500'>
              Connect third-party services to enhance your workflow
            </p>
          </div>
          <div class='p-6'>
            <GoogleDriveSettings />
          </div>
        </div>

        {/* About Section */}
        <div class='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
          <div class='border-b border-gray-200 bg-gray-50 px-6 py-4'>
            <div class='flex items-center space-x-2'>
              <FiInfo class='h-5 w-5 text-gray-600' />
              <h2 class='text-lg font-medium text-gray-900'>About</h2>
            </div>
          </div>
          <div class='p-6'>
            <div class='space-y-2 text-sm text-gray-600'>
              <p>
                <span class='font-medium text-gray-900'>CoRATES</span> - Collaborative Research
                Appraisal Tool for Evidence Synthesis
              </p>
              <p>Version 1.0.0</p>
              <p class='pt-2'>
                <a href={LANDING_URL} class='text-blue-600 hover:underline'>
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
