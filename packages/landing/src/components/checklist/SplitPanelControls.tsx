/**
 * SplitPanelControls - Toolbar controls for split panel layout
 * Used by SplitScreenLayout to provide consistent UI for toggling/configuring panels
 */

import {
  FileTextIcon,
  ExternalLinkIcon,
  Columns2Icon,
  RowsIcon,
  RefreshCwIcon,
} from 'lucide-react';

/* eslint-disable no-unused-vars */
interface SplitPanelControlsProps {
  showSecondPanel: boolean;
  onToggleSecondPanel?: () => void;
  layout: 'vertical' | 'horizontal';
  onSetLayout?: (layout: 'vertical' | 'horizontal') => void;
  onResetRatio?: () => void;
  secondPanelLabel?: string;
  defaultRatioLabel?: string;
  pdfUrl?: string | null;
  pdfData?: ArrayBuffer | null;
}
/* eslint-enable no-unused-vars */

export function SplitPanelControls({
  showSecondPanel,
  onToggleSecondPanel,
  layout,
  onSetLayout,
  onResetRatio,
  secondPanelLabel,
  defaultRatioLabel,
  pdfUrl,
  pdfData,
}: SplitPanelControlsProps) {
  const panelLabel = secondPanelLabel || 'second panel';
  const ratioLabel = defaultRatioLabel || '50/50';

  const hasPdf = !!(pdfUrl || pdfData);

  // Create a Blob URL on demand when the user clicks "open in new tab",
  // rather than eagerly allocating a copy of the PDF in memory on mount.
  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
      return;
    }
    if (!pdfData) return;
    try {
      const blob = new Blob([pdfData], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke after a short delay to allow the new tab to start loading
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (_e) {
      console.warn('Failed to create blob URL from PDF data:', _e);
    }
  };

  return (
    <div className='flex shrink-0 items-center gap-2'>
      {/* Toggle second panel */}
      <button
        onClick={() => onToggleSecondPanel?.()}
        className={`rounded p-1.5 transition-colors ${
          showSecondPanel ? 'bg-blue-100 text-blue-700' : 'text-muted-foreground hover:bg-secondary'
        }`}
        title={showSecondPanel ? `Hide ${panelLabel}` : `Show ${panelLabel}`}
      >
        <FileTextIcon className='h-5 w-5' />
      </button>

      {showSecondPanel && (
        <>
          <div className='bg-border mx-1 h-4 w-px' />

          {/* Vertical split (side by side) */}
          <button
            onClick={() => onSetLayout?.('vertical')}
            className={`rounded p-1.5 transition-colors ${
              layout === 'vertical' ?
                'bg-blue-100 text-blue-700'
              : 'text-muted-foreground hover:bg-secondary'
            }`}
            title='Side by side'
          >
            <Columns2Icon className='h-5 w-5' />
          </button>

          {/* Horizontal split (stacked) */}
          <button
            onClick={() => onSetLayout?.('horizontal')}
            className={`rounded p-1.5 transition-colors ${
              layout === 'horizontal' ?
                'bg-blue-100 text-blue-700'
              : 'text-muted-foreground hover:bg-secondary'
            }`}
            title='Stacked'
          >
            <RowsIcon className='h-5 w-5' />
          </button>

          {/* Reset ratio */}
          <button
            onClick={() => onResetRatio?.()}
            className='text-muted-foreground hover:bg-secondary rounded p-1.5 transition-colors'
            title={`Reset split (${ratioLabel})`}
          >
            <RefreshCwIcon className='h-5 w-5' />
          </button>

          {/* Open PDF in new tab */}
          {hasPdf && (
            <>
              <div className='bg-border mx-1 h-4 w-px' />
              <button
                onClick={handleOpenInNewTab}
                className='text-muted-foreground hover:bg-secondary rounded p-1.5 transition-colors'
                title='Open PDF in new tab'
              >
                <ExternalLinkIcon className='h-5 w-5' />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
