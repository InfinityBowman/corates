import { For, Show, Index } from 'solid-js';
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
 */
export default function ChartSettingsModal(props) {
  return (
    <Show when={props.isOpen}>
      {/* Backdrop - click to close */}
      <div class='fixed inset-0 bg-black/50 z-40' onClick={props.onClose} />

      {/* Modal */}
      <div class='fixed inset-0 z-50 flex items-center justify-center p-4' onClick={props.onClose}>
        <div
          class='bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col'
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div class='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
            <h2 class='text-lg font-semibold text-gray-900'>Chart Settings</h2>
            <button
              onClick={props.onClose}
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

            {/* Future sections placeholder */}
            <div class='mt-6 pt-6 border-t border-gray-200'>
              <h3 class='text-sm font-medium text-gray-400 mb-2'>Coming Soon</h3>
              <div class='space-y-2'>
                <div class='flex items-center gap-2 p-3 bg-gray-50 rounded-lg opacity-50'>
                  <span class='text-sm text-gray-500'>Export Options (PNG, SVG, CSV)</span>
                </div>
                <div class='flex items-center gap-2 p-3 bg-gray-50 rounded-lg opacity-50'>
                  <span class='text-sm text-gray-500'>Color Customization</span>
                </div>
                <div class='flex items-center gap-2 p-3 bg-gray-50 rounded-lg opacity-50'>
                  <span class='text-sm text-gray-500'>Chart Title</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div class='px-6 py-4 border-t border-gray-200 flex justify-end'>
            <button
              onClick={props.onClose}
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
