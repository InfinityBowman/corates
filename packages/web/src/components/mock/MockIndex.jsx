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

      <div class='space-y-4'>
        <h1 class='text-2xl font-bold text-gray-900'>Available Mocks</h1>

        <div class='grid gap-4'>
          <A
            href='/mock/robins-reconcile-section-b-question'
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
  );
}
