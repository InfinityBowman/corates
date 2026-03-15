/**
 * SplitScreenLayout - A resizable split-screen layout component
 * Supports vertical (side-by-side) and horizontal (stacked) orientations.
 * Expects exactly two children: the first is the checklist, the second is the PDF viewer.
 */

import { useState, useEffect, useRef, useCallback, Children } from 'react';
import { SplitPanelControls } from './SplitPanelControls';

interface SplitScreenLayoutProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
  defaultLayout?: 'vertical' | 'horizontal';
  defaultRatio?: number;
  showSecondPanel?: boolean;
  secondPanelLabel?: string;
  pdfUrl?: string | null;
  pdfData?: ArrayBuffer | null;
}

export function SplitScreenLayout({
  children,
  headerContent,
  defaultLayout = 'vertical',
  defaultRatio = 50,
  showSecondPanel: showSecondPanelProp = false,
  secondPanelLabel,
  pdfUrl,
  pdfData,
}: SplitScreenLayoutProps) {
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>(defaultLayout);
  const [splitRatio, setSplitRatio] = useState(defaultRatio);
  const [isDragging, setIsDragging] = useState(false);
  const [showSecondPanel, setShowSecondPanel] = useState(showSecondPanelProp);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync showSecondPanel with prop changes
  useEffect(() => {
    setShowSecondPanel(showSecondPanelProp ?? false); // eslint-disable-line react-hooks/set-state-in-effect -- syncing from prop
  }, [showSecondPanelProp]);

  // Extract exactly two panels from children
  const childArray = Children.toArray(children);
  const firstPanel = childArray[0] || null;
  const secondPanel = childArray[1] || null;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const handleMouseMove = (event: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let ratio: number;

        if (layout === 'vertical') {
          ratio = ((event.clientX - rect.left) / rect.width) * 100;
        } else {
          ratio = ((event.clientY - rect.top) / rect.height) * 100;
        }

        ratio = Math.max(20, Math.min(80, ratio));
        setSplitRatio(ratio);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [layout],
  );

  const toggleSecondPanel = useCallback(() => {
    setShowSecondPanel(prev => !prev);
  }, []);

  return (
    <div className='flex h-full flex-col'>
      {/* Combined header and layout controls */}
      <div className='border-border bg-card flex shrink-0 items-center justify-between border-b px-4 py-2'>
        {/* Left side: header content from parent */}
        <div className='flex min-w-0 items-center gap-3'>{headerContent}</div>

        {/* Right side: layout controls */}
        <SplitPanelControls
          showSecondPanel={showSecondPanel}
          onToggleSecondPanel={toggleSecondPanel}
          layout={layout}
          onSetLayout={setLayout}
          onResetRatio={() => setSplitRatio(defaultRatio)}
          secondPanelLabel={secondPanelLabel}
          defaultRatioLabel={defaultRatio ? `${defaultRatio}/${100 - defaultRatio}` : '50/50'}
          pdfUrl={pdfUrl}
          pdfData={pdfData}
        />
      </div>

      {/* Split content area */}
      <div
        ref={containerRef}
        className={`flex flex-1 overflow-hidden ${
          layout === 'vertical' ? 'flex-row' : 'flex-col'
        } ${isDragging ? 'select-none' : ''}`}
      >
        {/* First panel */}
        <div
          className='overflow-auto'
          style={{
            [layout === 'vertical' ? 'width' : 'height']:
              showSecondPanel ? `${splitRatio}%` : '100%',
            transition:
              isDragging ? 'none' : (
                `${layout === 'vertical' ? 'width' : 'height'} 200ms ease-in-out`
              ),
            willChange:
              isDragging ?
                layout === 'vertical' ?
                  'width'
                : 'height'
              : 'auto',
            transform: 'translateZ(0)',
            contain: 'layout',
          }}
        >
          {firstPanel}
        </div>

        {/* Divider / Resize handle */}
        {secondPanel && (
          <div
            onMouseDown={handleMouseDown}
            className={`${layout === 'vertical' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'} bg-border shrink-0 hover:bg-blue-400 active:bg-blue-500 ${
              isDragging ? 'bg-blue-500' : ''
            } ${showSecondPanel ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            style={{
              [layout === 'vertical' ? 'width' : 'height']: showSecondPanel ? undefined : '0',
              transition:
                isDragging ? 'none' : (
                  `opacity 300ms ease-in-out, ${layout === 'vertical' ? 'width' : 'height'} 200ms ease-in-out`
                ),
            }}
          />
        )}

        {/* Second panel with slide animation */}
        {secondPanel && (
          <div
            className='overflow-hidden'
            style={{
              [layout === 'vertical' ? 'width' : 'height']:
                showSecondPanel ? `${100 - splitRatio}%` : '0%',
              opacity: showSecondPanel ? 1 : 0,
              transform:
                showSecondPanel ? 'none'
                : layout === 'vertical' ? 'translateX(20px)'
                : 'translateY(20px)',
              transition:
                isDragging ? 'none' : (
                  `${layout === 'vertical' ? 'width' : 'height'} 200ms ease-in-out, opacity 200ms ease-in-out, transform 200ms ease-in-out`
                ),
              willChange:
                isDragging ?
                  layout === 'vertical' ?
                    'width'
                  : 'height'
                : 'auto',
              contain: 'style',
            }}
          >
            <div className='h-full w-full overflow-auto'>{secondPanel}</div>
          </div>
        )}
      </div>
    </div>
  );
}
