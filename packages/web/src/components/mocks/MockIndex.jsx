import { A } from '@solidjs/router';

/**
 * Mock Index - Landing page for visual-only mockups
 * These are temporary wireframes with no data/logic
 */
export default function MockIndex() {
  return (
    <div class='mx-auto max-w-4xl px-4 py-12'>
      <div class='mb-8 rounded-lg border-2 border-amber-200 bg-amber-50 p-4'>
        <h2 class='mb-2 text-lg font-semibold text-amber-900'>Mock Pages</h2>
        <p class='text-sm text-amber-800'>
          These are visual-only wireframes with no data loading, Yjs logic, or backend integration.
          They are temporary and will not reach production.
        </p>
      </div>

      <div class='space-y-6'>
        <h1 class='text-2xl font-bold text-gray-900'>Available Mocks</h1>

        {/* Featured Mocks */}
        <div>
          <h2 class='mb-3 text-lg font-semibold text-gray-700'>Featured</h2>
          <div class='grid gap-4'>
            <A
              href='/mocks/dashboard'
              class='block rounded-lg border-2 border-teal-200 bg-linear-to-br from-teal-50 to-white p-6 shadow-sm transition-all hover:border-teal-300 hover:shadow-md'
            >
              <div class='flex items-start justify-between'>
                <div>
                  <h3 class='mb-2 text-lg font-semibold text-gray-900'>
                    Main Dashboard - Academic Observatory
                  </h3>
                  <p class='mb-3 text-sm text-gray-600'>
                    Scientific manuscript meets modern data dashboard. Warm scholarly aesthetic with
                    Fraunces + Instrument Sans typography, paper-like textures, and teal/cyan
                    accents. Shows projects, local appraisals, progress, and activity.
                  </p>
                  <div class='flex flex-wrap gap-2'>
                    <span class='inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-700'>
                      Warm Light
                    </span>
                    <span class='inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700'>
                      Academic
                    </span>
                    <span class='inline-block rounded-full bg-cyan-100 px-3 py-1 text-xs font-medium text-cyan-700'>
                      Dashboard
                    </span>
                  </div>
                </div>
              </div>
            </A>
            <A
              href='/mocks/project-view-v2'
              class='block rounded-lg border-2 border-blue-200 bg-linear-to-br from-blue-50 to-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md'
            >
              <div class='flex items-start justify-between'>
                <div>
                  <h3 class='mb-2 text-lg font-semibold text-gray-900'>
                    ProjectView V2 - Modern Dashboard
                  </h3>
                  <p class='mb-3 text-sm text-gray-600'>
                    Refreshed design with blue palette, URL-persisted tabs, Overview dashboard,
                    improved table styling, and consistent design tokens matching the Project
                    Wizard.
                  </p>
                  <div class='flex flex-wrap gap-2'>
                    <span class='inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700'>
                      Blue Theme
                    </span>
                    <span class='inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700'>
                      URL State
                    </span>
                    <span class='inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700'>
                      7 Tabs
                    </span>
                  </div>
                </div>
                <span class='rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white'>
                  New
                </span>
              </div>
            </A>
            <A
              href='/mocks/project-view-complete'
              class='block rounded-lg border-2 border-violet-200 bg-linear-to-br from-violet-50 to-white p-6 shadow-sm transition-all hover:border-violet-300 hover:shadow-md'
            >
              <div class='flex items-start justify-between'>
                <div>
                  <h3 class='mb-2 text-lg font-semibold text-gray-900'>
                    ProjectView - Complete Workflow
                  </h3>
                  <p class='mb-3 text-sm text-gray-600'>
                    Full workflow with tabs for Team, Studies, To Do, Reconcile, Completed, and
                    Charts. Light-mode dashboard style with progress indicators and clear
                    navigation.
                  </p>
                  <div class='flex flex-wrap gap-2'>
                    <span class='inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700'>
                      Light Theme
                    </span>
                    <span class='inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700'>
                      Full Workflow
                    </span>
                    <span class='inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700'>
                      6 Tabs
                    </span>
                  </div>
                </div>
              </div>
            </A>
          </div>
        </div>

        {/* Other Mocks */}
        <div>
          <h2 class='mb-3 text-lg font-semibold text-gray-700'>Components</h2>
          <div class='grid gap-4'></div>
        </div>
      </div>
    </div>
  );
}
