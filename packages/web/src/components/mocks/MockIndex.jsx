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
              class='block rounded-lg border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 shadow-sm transition-all hover:border-teal-300 hover:shadow-md'
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
                <span class='rounded-full bg-teal-600 px-3 py-1 text-xs font-medium text-white'>
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
                <span class='rounded-full bg-violet-600 px-3 py-1 text-xs font-medium text-white'>
                  Recommended
                </span>
              </div>
            </A>
          </div>
        </div>

        {/* Add Studies Flow Mocks */}
        <div>
          <h2 class='mb-3 text-lg font-semibold text-gray-700'>Add Studies Flow</h2>
          <p class='mb-4 text-sm text-gray-500'>
            Different approaches for the study import workflow (PDF upload, DOI/PMID lookup,
            reference files, Google Drive) with smart deduplication and metadata enrichment.
          </p>
          <div class='grid gap-4'>
            <A
              href='/mocks/add-studies-wizard'
              class='block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md'
            >
              <h3 class='mb-2 text-lg font-semibold text-gray-900'>Add Studies - Wizard Modal</h3>
              <p class='text-sm text-gray-600'>
                Step-by-step wizard flow: Select sources, import content, review and dedupe,
                confirm. Best for guided onboarding and complex imports.
              </p>
              <div class='mt-3 flex gap-2'>
                <span class='inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700'>
                  Modal
                </span>
                <span class='inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700'>
                  3 Steps
                </span>
              </div>
            </A>

            <A
              href='/mocks/add-studies-panel'
              class='block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md'
            >
              <h3 class='mb-2 text-lg font-semibold text-gray-900'>
                Add Studies - Slide-over Panel
              </h3>
              <p class='text-sm text-gray-600'>
                Tabbed slide-over panel with all import sources available at once. Real-time staging
                area shows studies as they're added with live dedup feedback.
              </p>
              <div class='mt-3 flex gap-2'>
                <span class='inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700'>
                  Panel
                </span>
                <span class='inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700'>
                  Tabbed
                </span>
              </div>
            </A>

            <A
              href='/mocks/add-studies-inline'
              class='block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md'
            >
              <h3 class='mb-2 text-lg font-semibold text-gray-900'>
                Add Studies - Inline Progressive
              </h3>
              <p class='text-sm text-gray-600'>
                Lives directly on the page. Drop zone first with progressive disclosure for other
                import options. Good for quick additions without losing context.
              </p>
              <div class='mt-3 flex gap-2'>
                <span class='inline-block rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700'>
                  Inline
                </span>
                <span class='inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700'>
                  Progressive
                </span>
              </div>
            </A>
          </div>
        </div>

        {/* Other ProjectView Style Explorations */}
        <div>
          <h2 class='mb-3 text-lg font-semibold text-gray-700'>ProjectView Style Explorations</h2>
          <div class='grid gap-4'>
            <A
              href='/mocks/project-view-editorial'
              class='block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md'
            >
              <h3 class='mb-2 text-lg font-semibold text-gray-900'>
                ProjectView - Editorial/Magazine Style
              </h3>
              <p class='text-sm text-gray-600'>
                Clean, typographic, newspaper-inspired design with serif fonts, strong hierarchy,
                and generous whitespace. Inspired by NYT and academic journals.
              </p>
              <span class='mt-3 inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700'>
                Light Theme
              </span>
            </A>

            <A
              href='/mocks/project-view-dashboard'
              class='block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md'
            >
              <h3 class='mb-2 text-lg font-semibold text-gray-900'>
                ProjectView - Dashboard/Analytical Style
              </h3>
              <p class='text-sm text-gray-600'>
                Data-focused design with visual progress indicators, glassmorphism, and animated
                elements. Inspired by Linear and modern SaaS dashboards.
              </p>
              <span class='mt-3 inline-block rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200'>
                Dark Theme
              </span>
            </A>

            <A
              href='/mocks/project-view-kanban'
              class='block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md'
            >
              <h3 class='mb-2 text-lg font-semibold text-gray-900'>
                ProjectView - Kanban/Board Style
              </h3>
              <p class='text-sm text-gray-600'>
                Spatial organization with columns for workflow stages, drag-drop potential, and
                paper-like textures. Inspired by Notion and Linear.
              </p>
              <span class='mt-3 inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700'>
                Warm Light Theme
              </span>
            </A>
          </div>
        </div>

        {/* Settings Page Mocks */}
        <div>
          <h2 class='mb-3 text-lg font-semibold text-gray-700'>Settings Page Mocks</h2>
          <p class='mb-4 text-sm text-gray-500'>
            Different approaches for the settings/preferences page layout with various visual styles
            and information architecture.
          </p>
          <div class='grid gap-4'>
            <A
              href='/mocks/settings-combined'
              class='block rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md'
            >
              <div class='flex items-start justify-between'>
                <div>
                  <h3 class='mb-2 text-lg font-semibold text-gray-900'>
                    Settings - Combined Profile & Settings
                  </h3>
                  <p class='mb-3 text-sm text-gray-600'>
                    Unified profile and settings in one place. Minimal Swiss style with app's blue
                    color scheme. Includes profile editing, linked accounts, billing, security, 2FA,
                    sessions, notifications, and integrations.
                  </p>
                  <div class='flex flex-wrap gap-2'>
                    <span class='inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700'>
                      App Colors
                    </span>
                    <span class='inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700'>
                      Sidebar Nav
                    </span>
                    <span class='inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700'>
                      Profile + Settings
                    </span>
                  </div>
                </div>
                <span class='rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white'>
                  Recommended
                </span>
              </div>
            </A>

            <A
              href='/mocks/settings-bento'
              class='block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md'
            >
              <h3 class='mb-2 text-lg font-semibold text-gray-900'>Settings - Bento Box Style</h3>
              <p class='text-sm text-gray-600'>
                Modern dashboard-inspired bento grid layout with varied card sizes, progress rings,
                and gradient accents. Apple-inspired aesthetics.
              </p>
              <div class='mt-3 flex gap-2'>
                <span class='inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700'>
                  Grid Layout
                </span>
                <span class='inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700'>
                  Modern
                </span>
              </div>
            </A>

            <A
              href='/mocks/settings-minimal'
              class='block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md'
            >
              <h3 class='mb-2 text-lg font-semibold text-gray-900'>
                Settings - Minimal Swiss Style
              </h3>
              <p class='text-sm text-gray-600'>
                Clean, typographic, understated elegance with strong hierarchy, generous whitespace,
                and sidebar navigation. Dieter Rams-inspired.
              </p>
              <div class='mt-3 flex gap-2'>
                <span class='inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700'>
                  Sidebar Nav
                </span>
                <span class='inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700'>
                  Minimal
                </span>
              </div>
            </A>
          </div>
        </div>

        {/* Other Mocks */}
        <div>
          <h2 class='mb-3 text-lg font-semibold text-gray-700'>Other Mocks</h2>
          <div class='grid gap-4'>
            <A
              href='/mocks/robins-reconcile-section-b-question'
              class='block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md'
            >
              <h3 class='mb-2 text-lg font-semibold text-gray-900'>
                ROBINS-I Section B Question Reconcile
              </h3>
              <p class='text-sm text-gray-600'>
                Three-column compare view for a single Section B question with always-visible
                comments.
              </p>
            </A>
          </div>
        </div>
      </div>
    </div>
  );
}
