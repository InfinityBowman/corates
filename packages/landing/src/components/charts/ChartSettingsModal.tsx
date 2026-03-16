/**
 * ChartSettingsModal - Modal for editing chart settings, labels, titles, and export options.
 */

import { useState } from 'react';
import { XIcon } from 'lucide-react';

interface LabelItem {
  id: string;
  label: string;
}

interface ChartSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  labels: LabelItem[];
  onLabelChange: (_index: number, _newValue: string) => void;
  greyscale: boolean;
  onGreyscaleChange: (_value: boolean) => void;
  robvisTitle: string;
  onRobvisTitleChange: (_value: string) => void;
  distributionTitle: string;
  onDistributionTitleChange: (_value: string) => void;
  onExportRobvis: (_format: 'svg' | 'png') => void;
  onExportDistribution: (_format: 'svg' | 'png') => void;
  transparentExport: boolean;
  onTransparentExportChange: (_value: boolean) => void;
}

export function ChartSettingsModal({
  isOpen,
  onClose,
  labels,
  onLabelChange,
  greyscale,
  onGreyscaleChange,
  robvisTitle,
  onRobvisTitleChange,
  distributionTitle,
  onDistributionTitleChange,
  onExportRobvis,
  onExportDistribution,
  transparentExport,
  onTransparentExportChange,
}: ChartSettingsModalProps) {
  const [mouseDownOnBackdrop, setMouseDownOnBackdrop] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onMouseDown={e => { if (e.target === e.currentTarget) setMouseDownOnBackdrop(true); }}
        onMouseUp={e => {
          if (mouseDownOnBackdrop && e.target === e.currentTarget) onClose();
          setMouseDownOnBackdrop(false);
        }}
      >
        <div
          className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl"
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Chart Settings</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Labels Section */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-gray-700">Chart Labels</h3>
              <p className="mb-4 text-xs text-gray-500">
                Edit labels directly. Changes are temporary and won't be saved.
              </p>
              <div className="space-y-2">
                {labels.map((item, index) => (
                  <input
                    key={item.id}
                    type="text"
                    value={item.label}
                    onChange={e => onLabelChange(index, e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                ))}
              </div>
              {labels.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">
                  No chart data available to edit.
                </p>
              )}
            </div>

            {/* Chart Titles Section */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="mb-3 text-sm font-medium text-gray-700">Chart Titles</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Quality Assessment Chart</label>
                  <input
                    type="text"
                    value={robvisTitle}
                    onChange={e => onRobvisTitleChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Distribution Chart</label>
                  <input
                    type="text"
                    value={distributionTitle}
                    onChange={e => onDistributionTitleChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Display Options */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="mb-3 text-sm font-medium text-gray-700">Display Options</h3>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={greyscale}
                  onChange={e => onGreyscaleChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Greyscale Mode</span>
                  <p className="text-xs text-gray-500">Use greyscale colors for print-friendly charts</p>
                </div>
              </label>
            </div>

            {/* Export Section */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="mb-3 text-sm font-medium text-gray-700">Export Charts</h3>
              <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={transparentExport}
                  onChange={e => onTransparentExportChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Transparent Background</span>
                  <p className="text-xs text-gray-500">Export without white background</p>
                </div>
              </label>

              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="mb-2 text-sm font-medium text-gray-700">Quality Assessment Chart</p>
                  <div className="flex gap-2">
                    <button onClick={() => onExportRobvis('svg')} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">Export SVG</button>
                    <button onClick={() => onExportRobvis('png')} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">Export PNG</button>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="mb-2 text-sm font-medium text-gray-700">Distribution Chart</p>
                  <div className="flex gap-2">
                    <button onClick={() => onExportDistribution('svg')} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">Export SVG</button>
                    <button onClick={() => onExportDistribution('png')} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">Export PNG</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Citation Section */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="mb-3 text-sm font-medium text-gray-700">How to Cite CoRATES</h3>
              <p className="mb-4 text-xs text-gray-500">
                Use this citation when you reference CoRATES as the software used for study appraisal.
              </p>
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-4">
                  <h4 className="mb-2 text-xs font-semibold text-gray-700">APA</h4>
                  <p className="text-sm leading-relaxed text-gray-700">
                    Maynard, J. A., & Maynard, B. R. (2025). CoRATES (Collaborative Risk-of-Bias and
                    Appraisal Tracking for Evidence Synthesis) [Software]. https://corates.org
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <h4 className="mb-2 text-xs font-semibold text-gray-700">AMA</h4>
                  <p className="text-sm leading-relaxed text-gray-700">
                    Maynard JA, Maynard BR. CoRATES (Collaborative Risk-of-Bias and Appraisal
                    Tracking for Evidence Synthesis)[software]. 2025. Accessed Month Day, Year.
                    https://corates.org
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-gray-200 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
