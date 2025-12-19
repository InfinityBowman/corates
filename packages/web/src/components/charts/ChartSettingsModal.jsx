import { Show, Index, createSignal } from 'solid-js';
import { BiRegularX } from 'solid-icons/bi';
import { Z_INDEX } from '@corates/ui';

/**
 * ChartSettingsModal - Modal for editing chart settings like labels
 *
 * Props:
 * - isOpen: boolean signal
 * - onClose: () => void
 * - labels: array of { id, label } objects
 * - onLabelChange: (index, newValue) => void - called when a single label changes
 * - greyscale: boolean - whether charts are in greyscale mode
 * - onGreyscaleChange: (value) => void - toggle greyscale mode
 * - robvisTitle: string - title for the quality assessment chart
 * - onRobvisTitleChange: (value) => void - update robvis title
 * - distributionTitle: string - title for the distribution chart
 * - onDistributionTitleChange: (value) => void - update distribution title
 * - onExportRobvis: (format: 'svg' | 'png') => void - export quality assessment chart
 * - onExportDistribution: (format: 'svg' | 'png') => void - export distribution chart
 * - transparentExport: boolean - whether to export with transparent background
 * - onTransparentExportChange: (value) => void - toggle transparent export
 */
export default function ChartSettingsModal(props) {
  // Track if mousedown started on backdrop (not inside modal)
  const [mouseDownOnBackdrop, setMouseDownOnBackdrop] = createSignal(false);

  const handleBackdropMouseDown = e => {
    // Only set true if clicking directly on backdrop, not on modal content
    if (e.target === e.currentTarget) {
      setMouseDownOnBackdrop(true);
    }
  };

  const handleBackdropMouseUp = e => {
    // Only close if both mousedown and mouseup happened on backdrop
    if (mouseDownOnBackdrop() && e.target === e.currentTarget) {
      props.onClose();
    }
    setMouseDownOnBackdrop(false);
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop - click to close */}
      <div class={`fixed inset-0 ${Z_INDEX.BACKDROP} bg-black/50`} />

      {/* Modal */}
      <div
        class={`fixed inset-0 ${Z_INDEX.DIALOG} flex items-center justify-center p-4`}
        onMouseDown={handleBackdropMouseDown}
        onMouseUp={handleBackdropMouseUp}
      >
        <div
          class='flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl'
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Header */}
          <div class='flex items-center justify-between border-b border-gray-200 px-6 py-4'>
            <h2 class='text-lg font-semibold text-gray-900'>Chart Settings</h2>
            <button
              onClick={() => props.onClose?.()}
              class='rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'
            >
              <BiRegularX class='h-5 w-5' />
            </button>
          </div>

          {/* Content */}
          <div class='flex-1 overflow-y-auto p-6'>
            {/* Labels Section */}
            <div>
              <h3 class='mb-3 text-sm font-medium text-gray-700'>Chart Labels</h3>
              <p class='mb-4 text-xs text-gray-500'>
                Edit labels directly. Changes are temporary and won't be saved.
              </p>

              <div class='space-y-2'>
                <Index each={props.labels}>
                  {(item, index) => (
                    <input
                      type='text'
                      value={item().label}
                      onInput={e => props.onLabelChange(index, e.target.value)}
                      class='w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                    />
                  )}
                </Index>
              </div>

              <Show when={props.labels.length === 0}>
                <p class='py-4 text-center text-sm text-gray-400'>
                  No chart data available to edit.
                </p>
              </Show>
            </div>

            {/* Chart Titles Section */}
            <div class='mt-6 border-t border-gray-200 pt-6'>
              <h3 class='mb-3 text-sm font-medium text-gray-700'>Chart Titles</h3>
              <div class='space-y-3'>
                <div>
                  <label class='mb-1 block text-xs text-gray-500'>Quality Assessment Chart</label>
                  <input
                    type='text'
                    value={props.robvisTitle}
                    onInput={e => props.onRobvisTitleChange(e.target.value)}
                    class='w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                  />
                </div>
                <div>
                  <label class='mb-1 block text-xs text-gray-500'>Distribution Chart</label>
                  <input
                    type='text'
                    value={props.distributionTitle}
                    onInput={e => props.onDistributionTitleChange(e.target.value)}
                    class='w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                  />
                </div>
              </div>
            </div>

            {/* Display Options Section */}
            <div class='mt-6 border-t border-gray-200 pt-6'>
              <h3 class='mb-3 text-sm font-medium text-gray-700'>Display Options</h3>

              <label class='flex cursor-pointer items-center gap-3 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100'>
                <input
                  type='checkbox'
                  checked={props.greyscale}
                  onChange={e => props.onGreyscaleChange(e.target.checked)}
                  class='h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500'
                />
                <div>
                  <span class='text-sm font-medium text-gray-700'>Greyscale Mode</span>
                  <p class='text-xs text-gray-500'>
                    Use greyscale colors for print-friendly charts
                  </p>
                </div>
              </label>
            </div>

            {/* Export Section */}
            <div class='mt-6 border-t border-gray-200 pt-6'>
              <h3 class='mb-3 text-sm font-medium text-gray-700'>Export Charts</h3>

              <label class='mb-3 flex cursor-pointer items-center gap-3 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100'>
                <input
                  type='checkbox'
                  checked={props.transparentExport}
                  onChange={e => props.onTransparentExportChange(e.target.checked)}
                  class='h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500'
                />
                <div>
                  <span class='text-sm font-medium text-gray-700'>Transparent Background</span>
                  <p class='text-xs text-gray-500'>Export without white background</p>
                </div>
              </label>

              <div class='space-y-3'>
                <div class='rounded-lg bg-gray-50 p-3'>
                  <p class='mb-2 text-sm font-medium text-gray-700'>Quality Assessment Chart</p>
                  <div class='flex gap-2'>
                    <button
                      onClick={() => props.onExportRobvis('svg')}
                      class='rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50'
                    >
                      Export SVG
                    </button>
                    <button
                      onClick={() => props.onExportRobvis('png')}
                      class='rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50'
                    >
                      Export PNG
                    </button>
                  </div>
                </div>
                <div class='rounded-lg bg-gray-50 p-3'>
                  <p class='mb-2 text-sm font-medium text-gray-700'>Distribution Chart</p>
                  <div class='flex gap-2'>
                    <button
                      onClick={() => props.onExportDistribution('svg')}
                      class='rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50'
                    >
                      Export SVG
                    </button>
                    <button
                      onClick={() => props.onExportDistribution('png')}
                      class='rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50'
                    >
                      Export PNG
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* How to Cite CoRATES Section */}
            <div class='mt-6 border-t border-gray-200 pt-6'>
              <h3 class='mb-3 text-sm font-medium text-gray-700'>How to Cite CoRATES</h3>
              <p class='mb-4 text-xs text-gray-500'>
                Use this citation when you reference CoRATES as the software used for study
                appraisal.
              </p>

              <div class='space-y-4'>
                <div class='rounded-lg bg-gray-50 p-4'>
                  <h4 class='mb-2 text-xs font-semibold text-gray-700'>APA</h4>
                  <p class='text-sm leading-relaxed text-gray-700'>
                    Maynard, J. A., & Maynard, B. R. (2025). CoRATES (Collaborative Risk-of-Bias and
                    Appraisal Tracking for Evidence Synthesis) [Software]. https://corates.org
                  </p>
                </div>

                <div class='rounded-lg bg-gray-50 p-4'>
                  <h4 class='mb-2 text-xs font-semibold text-gray-700'>AMA</h4>
                  <p class='text-sm leading-relaxed text-gray-700'>
                    Maynard JA, Maynard BR. CoRATES (Collaborative Risk-of-Bias and Appraisal
                    Tracking for Evidence Synthesis)[software]. 2025. Accessed Month Day, Year.
                    https://corates.org
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div class='flex justify-end border-t border-gray-200 px-6 py-4'>
            <button
              onClick={() => props.onClose?.()}
              class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
