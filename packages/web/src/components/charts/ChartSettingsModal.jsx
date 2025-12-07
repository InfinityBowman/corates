import { Show, Index, createSignal } from 'solid-js';
import { BiRegularX } from 'solid-icons/bi';

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
      <div class='fixed inset-0 bg-black/50 z-40' />

      {/* Modal */}
      <div
        class='fixed inset-0 z-50 flex items-center justify-center p-4'
        onMouseDown={handleBackdropMouseDown}
        onMouseUp={handleBackdropMouseUp}
      >
        <div
          class='bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col'
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Header */}
          <div class='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
            <h2 class='text-lg font-semibold text-gray-900'>Chart Settings</h2>
            <button
              onClick={() => props.onClose?.()}
              class='p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors'
            >
              <BiRegularX class='w-5 h-5' />
            </button>
          </div>

          {/* Content */}
          <div class='flex-1 overflow-y-auto p-6'>
            {/* Labels Section */}
            <div>
              <h3 class='text-sm font-medium text-gray-700 mb-3'>Chart Labels</h3>
              <p class='text-xs text-gray-500 mb-4'>
                Edit labels directly. Changes are temporary and won't be saved.
              </p>

              <div class='space-y-2'>
                <Index each={props.labels}>
                  {(item, index) => (
                    <input
                      type='text'
                      value={item().label}
                      onInput={e => props.onLabelChange(index, e.target.value)}
                      class='w-full text-sm text-gray-700 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-colors'
                    />
                  )}
                </Index>
              </div>

              <Show when={props.labels.length === 0}>
                <p class='text-sm text-gray-400 text-center py-4'>
                  No chart data available to edit.
                </p>
              </Show>
            </div>

            {/* Chart Titles Section */}
            <div class='mt-6 pt-6 border-t border-gray-200'>
              <h3 class='text-sm font-medium text-gray-700 mb-3'>Chart Titles</h3>
              <div class='space-y-3'>
                <div>
                  <label class='block text-xs text-gray-500 mb-1'>
                    Quality Assessment Chart
                  </label>
                  <input
                    type='text'
                    value={props.robvisTitle}
                    onInput={e => props.onRobvisTitleChange(e.target.value)}
                    class='w-full text-sm text-gray-700 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-colors'
                  />
                </div>
                <div>
                  <label class='block text-xs text-gray-500 mb-1'>
                    Distribution Chart
                  </label>
                  <input
                    type='text'
                    value={props.distributionTitle}
                    onInput={e => props.onDistributionTitleChange(e.target.value)}
                    class='w-full text-sm text-gray-700 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-colors'
                  />
                </div>
              </div>
            </div>

            {/* Display Options Section */}
            <div class='mt-6 pt-6 border-t border-gray-200'>
              <h3 class='text-sm font-medium text-gray-700 mb-3'>Display Options</h3>

              <label class='flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'>
                <input
                  type='checkbox'
                  checked={props.greyscale}
                  onChange={e => props.onGreyscaleChange(e.target.checked)}
                  class='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2'
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
            <div class='mt-6 pt-6 border-t border-gray-200'>
              <h3 class='text-sm font-medium text-gray-700 mb-3'>Export Charts</h3>

              <label class='flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors mb-3'>
                <input
                  type='checkbox'
                  checked={props.transparentExport}
                  onChange={e => props.onTransparentExportChange(e.target.checked)}
                  class='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2'
                />
                <div>
                  <span class='text-sm font-medium text-gray-700'>
                    Transparent Background
                  </span>
                  <p class='text-xs text-gray-500'>Export without white background</p>
                </div>
              </label>

              <div class='space-y-3'>
                <div class='p-3 bg-gray-50 rounded-lg'>
                  <p class='text-sm font-medium text-gray-700 mb-2'>
                    Quality Assessment Chart
                  </p>
                  <div class='flex gap-2'>
                    <button
                      onClick={() => props.onExportRobvis('svg')}
                      class='px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
                    >
                      Export SVG
                    </button>
                    <button
                      onClick={() => props.onExportRobvis('png')}
                      class='px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
                    >
                      Export PNG
                    </button>
                  </div>
                </div>
                <div class='p-3 bg-gray-50 rounded-lg'>
                  <p class='text-sm font-medium text-gray-700 mb-2'>Distribution Chart</p>
                  <div class='flex gap-2'>
                    <button
                      onClick={() => props.onExportDistribution('svg')}
                      class='px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
                    >
                      Export SVG
                    </button>
                    <button
                      onClick={() => props.onExportDistribution('png')}
                      class='px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
                    >
                      Export PNG
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* How to Cite CoRATES Section */}
            <div class='mt-6 pt-6 border-t border-gray-200'>
              <h3 class='text-sm font-medium text-gray-700 mb-3'>How to Cite CoRATES</h3>
              <p class='text-xs text-gray-500 mb-4'>
                Use this citation when you reference CoRATES as the software used for
                study appraisal.
              </p>

              <div class='space-y-4'>
                <div class='p-4 bg-gray-50 rounded-lg'>
                  <h4 class='text-xs font-semibold text-gray-700 mb-2'>APA</h4>
                  <p class='text-sm text-gray-700 leading-relaxed'>
                    Maynard, J. A., & Maynard, B. R. (2025). CoRATES (Collaborative
                    Risk-of-Bias and Appraisal Tracking for Evidence Synthesis)
                    [Software]. https://corates.org
                  </p>
                </div>

                <div class='p-4 bg-gray-50 rounded-lg'>
                  <h4 class='text-xs font-semibold text-gray-700 mb-2'>AMA</h4>
                  <p class='text-sm text-gray-700 leading-relaxed'>
                    Maynard JA, Maynard BR. CoRATES (Collaborative Risk-of-Bias and
                    Appraisal Tracking for Evidence Synthesis)[software]. 2025. Accessed
                    Month Day, Year. https://corates.org
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div class='px-6 py-4 border-t border-gray-200 flex justify-end'>
            <button
              onClick={() => props.onClose?.()}
              class='px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
