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
      <div className='fixed inset-0 z-40 bg-black/50' />

      {/* Modal */}
      <div
        className='fixed inset-0 z-50 flex items-center justify-center p-4'
        onMouseDown={e => {
          if (e.target === e.currentTarget) setMouseDownOnBackdrop(true);
        }}
        onMouseUp={e => {
          if (mouseDownOnBackdrop && e.target === e.currentTarget) onClose();
          setMouseDownOnBackdrop(false);
        }}
      >
        <div
          className='bg-card flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl shadow-2xl'
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className='border-border flex items-center justify-between border-b px-6 py-4'>
            <h2 className='text-foreground text-lg font-semibold'>Chart Settings</h2>
            <button
              onClick={onClose}
              className='text-muted-foreground hover:bg-muted hover:text-muted-foreground rounded-lg p-1.5 transition-colors'
            >
              <XIcon className='size-5' />
            </button>
          </div>

          {/* Content */}
          <div className='flex-1 overflow-y-auto p-6'>
            {/* Labels Section */}
            <div>
              <h3 className='text-foreground mb-3 text-sm font-medium'>Chart Labels</h3>
              <p className='text-muted-foreground mb-4 text-xs'>
                Edit labels directly. Changes are temporary and won't be saved.
              </p>
              <div className='flex flex-col gap-2'>
                {labels.map((item, index) => (
                  <input
                    key={item.id}
                    type='text'
                    value={item.label}
                    onChange={e => onLabelChange(index, e.target.value)}
                    className='border-border bg-muted text-foreground w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                  />
                ))}
              </div>
              {labels.length === 0 && (
                <p className='text-muted-foreground py-4 text-center text-sm'>
                  No chart data available to edit.
                </p>
              )}
            </div>

            {/* Chart Titles Section */}
            <div className='border-border mt-6 border-t pt-6'>
              <h3 className='text-foreground mb-3 text-sm font-medium'>Chart Titles</h3>
              <div className='flex flex-col gap-3'>
                <div>
                  <label className='text-muted-foreground mb-1 block text-xs'>
                    Quality Assessment Chart
                  </label>
                  <input
                    type='text'
                    value={robvisTitle}
                    onChange={e => onRobvisTitleChange(e.target.value)}
                    className='border-border bg-muted text-foreground w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                  />
                </div>
                <div>
                  <label className='text-muted-foreground mb-1 block text-xs'>
                    Distribution Chart
                  </label>
                  <input
                    type='text'
                    value={distributionTitle}
                    onChange={e => onDistributionTitleChange(e.target.value)}
                    className='border-border bg-muted text-foreground w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                  />
                </div>
              </div>
            </div>

            {/* Display Options */}
            <div className='border-border mt-6 border-t pt-6'>
              <h3 className='text-foreground mb-3 text-sm font-medium'>Display Options</h3>
              <label className='bg-muted hover:bg-muted/80 flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors'>
                <input
                  type='checkbox'
                  checked={greyscale}
                  onChange={e => onGreyscaleChange(e.target.checked)}
                  className='border-border bg-muted size-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500'
                />
                <div>
                  <span className='text-foreground text-sm font-medium'>Greyscale Mode</span>
                  <p className='text-muted-foreground text-xs'>
                    Use greyscale colors for print-friendly charts
                  </p>
                </div>
              </label>
            </div>

            {/* Export Section */}
            <div className='border-border mt-6 border-t pt-6'>
              <h3 className='text-foreground mb-3 text-sm font-medium'>Export Charts</h3>
              <label className='bg-muted hover:bg-muted/80 mb-3 flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors'>
                <input
                  type='checkbox'
                  checked={transparentExport}
                  onChange={e => onTransparentExportChange(e.target.checked)}
                  className='border-border bg-muted size-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500'
                />
                <div>
                  <span className='text-foreground text-sm font-medium'>
                    Transparent Background
                  </span>
                  <p className='text-muted-foreground text-xs'>Export without white background</p>
                </div>
              </label>

              <div className='flex flex-col gap-3'>
                <div className='bg-muted rounded-lg p-3'>
                  <p className='text-foreground mb-2 text-sm font-medium'>
                    Quality Assessment Chart
                  </p>
                  <div className='flex gap-2'>
                    <button
                      onClick={() => onExportRobvis('svg')}
                      className='border-border bg-card text-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium transition-colors'
                    >
                      Export SVG
                    </button>
                    <button
                      onClick={() => onExportRobvis('png')}
                      className='border-border bg-card text-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium transition-colors'
                    >
                      Export PNG
                    </button>
                  </div>
                </div>
                <div className='bg-muted rounded-lg p-3'>
                  <p className='text-foreground mb-2 text-sm font-medium'>Distribution Chart</p>
                  <div className='flex gap-2'>
                    <button
                      onClick={() => onExportDistribution('svg')}
                      className='border-border bg-card text-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium transition-colors'
                    >
                      Export SVG
                    </button>
                    <button
                      onClick={() => onExportDistribution('png')}
                      className='border-border bg-card text-foreground hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium transition-colors'
                    >
                      Export PNG
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Citation Section */}
            <div className='border-border mt-6 border-t pt-6'>
              <h3 className='text-foreground mb-3 text-sm font-medium'>How to Cite CoRATES</h3>
              <p className='text-muted-foreground mb-4 text-xs'>
                Use this citation when you reference CoRATES as the software used for study
                appraisal.
              </p>
              <div className='flex flex-col gap-4'>
                <div className='bg-muted rounded-lg p-4'>
                  <h4 className='text-foreground mb-2 text-xs font-semibold'>APA</h4>
                  <p className='text-foreground text-sm leading-relaxed'>
                    Maynard, J. A., & Maynard, B. R. (2025). CoRATES (Collaborative Risk-of-Bias and
                    Appraisal Tracking for Evidence Synthesis) [Software]. https://corates.org
                  </p>
                </div>
                <div className='bg-muted rounded-lg p-4'>
                  <h4 className='text-foreground mb-2 text-xs font-semibold'>AMA</h4>
                  <p className='text-foreground text-sm leading-relaxed'>
                    Maynard JA, Maynard BR. CoRATES (Collaborative Risk-of-Bias and Appraisal
                    Tracking for Evidence Synthesis)[software]. 2025. Accessed Month Day, Year.
                    https://corates.org
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className='border-border flex justify-end border-t px-6 py-4'>
            <button
              onClick={onClose}
              className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
