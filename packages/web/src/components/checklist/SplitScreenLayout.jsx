/**
 * SplitScreenLayout - A resizable split-screen layout component
 * Supports vertical (side-by-side) and horizontal (stacked) orientations
 */

import { createSignal, createEffect, Show, children as resolveChildren } from 'solid-js';
import SplitPanelControls from './SplitPanelControls.jsx';

export default function SplitScreenLayout(props) {
  // props.headerContent - optional content to render on the left side of the toolbar
  // props.defaultLayout - 'vertical' or 'horizontal' (default: 'vertical')
  // props.defaultRatio - default split ratio (default: 50)
  // props.showSecondPanel - external control for second panel visibility
  // props.secondPanelLabel - label for toggle button (e.g., "PDF viewer")
  // props.pdfUrl - optional PDF URL (for server-hosted PDFs)
  // props.pdfData - optional PDF ArrayBuffer (for local PDFs)
  // Layout: 'vertical' = side by side, 'horizontal' = stacked
  const [layout, setLayout] = createSignal(props.defaultLayout || 'vertical');
  const [splitRatio, setSplitRatio] = createSignal(props.defaultRatio || 50);
  const [isDragging, setIsDragging] = createSignal(false);
  const [showSecondPanel, setShowSecondPanel] = createSignal(false);

  // Sync showSecondPanel with prop changes
  createEffect(() => {
    setShowSecondPanel(props.showSecondPanel ?? true);
  });

  let containerRef;

  const resolvedChildren = resolveChildren(() => props.children);

  // Get the two panels from children
  const panels = () => {
    const kids = resolvedChildren();
    if (Array.isArray(kids)) {
      return kids.slice(0, 2);
    }
    return [kids];
  };

  const firstPanel = () => panels()[0];
  const secondPanel = () => panels()[1];

  function handleMouseDown(e) {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = event => {
      if (!containerRef) return;

      const rect = containerRef.getBoundingClientRect();
      let ratio;

      if (layout() === 'vertical') {
        ratio = ((event.clientX - rect.left) / rect.width) * 100;
      } else {
        ratio = ((event.clientY - rect.top) / rect.height) * 100;
      }

      // Clamp between 20% and 80%
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
  }

  function toggleSecondPanel() {
    setShowSecondPanel(!showSecondPanel());
  }

  return (
    <div class='flex h-full flex-col'>
      {/* Combined header and layout controls */}
      <div class='flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2'>
        {/* Left side: header content from parent */}
        <div class='flex min-w-0 items-center gap-3'>{props.headerContent}</div>

        {/* Right side: layout controls */}
        <SplitPanelControls
          showSecondPanel={showSecondPanel()}
          onToggleSecondPanel={toggleSecondPanel}
          layout={layout()}
          onSetLayout={setLayout}
          onResetRatio={() => setSplitRatio(props.defaultRatio || 50)}
          secondPanelLabel={props.secondPanelLabel}
          defaultRatioLabel={
            props.defaultRatio ? `${props.defaultRatio}/${100 - props.defaultRatio}` : '50/50'
          }
          pdfUrl={props.pdfUrl}
          pdfData={props.pdfData}
        />
      </div>

      {/* Split content area */}
      <div
        ref={containerRef}
        class={`flex flex-1 overflow-hidden ${
          layout() === 'vertical' ? 'flex-row' : 'flex-col'
        } ${isDragging() ? 'select-none' : ''}`}
      >
        {/* First panel */}
        <div
          class='overflow-auto'
          style={{
            [layout() === 'vertical' ? 'width' : 'height']:
              showSecondPanel() ? `${splitRatio()}%` : '100%',
            transition:
              isDragging() ? 'none' : (
                `${layout() === 'vertical' ? 'width' : 'height'} 200ms ease-in-out`
              ),
            'will-change':
              isDragging() ?
                layout() === 'vertical' ?
                  'width'
                : 'height'
              : 'auto',
            transform: 'translateZ(0)',
            contain: 'layout',
          }}
        >
          {firstPanel()}
        </div>

        {/* Divider / Resize handle with animation */}
        <Show when={secondPanel()}>
          <div
            onMouseDown={handleMouseDown}
            class={`${layout() === 'vertical' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'} shrink-0 bg-gray-200 hover:bg-blue-400 active:bg-blue-500 ${
              isDragging() ? 'bg-blue-500' : ''
            } ${showSecondPanel() ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            style={{
              [layout() === 'vertical' ? 'width' : 'height']: showSecondPanel() ? undefined : '0',
              transition:
                isDragging() ? 'none' : (
                  `opacity 300ms ease-in-out, ${layout() === 'vertical' ? 'width' : 'height'} 200ms ease-in-out`
                ),
            }}
          />
        </Show>

        {/* Second panel with slide animation */}
        <Show when={secondPanel()}>
          <div
            class='overflow-hidden'
            style={{
              [layout() === 'vertical' ? 'width' : 'height']:
                showSecondPanel() ? `${100 - splitRatio()}%` : '0%',
              opacity: showSecondPanel() ? 1 : 0,
              // Only apply transform when hidden to avoid creating containing block for fixed menus
              transform: showSecondPanel() ? 'none' : (
                layout() === 'vertical' ? 'translateX(20px)' : 'translateY(20px)'
              ),
              transition:
                isDragging() ? 'none' : (
                  `${layout() === 'vertical' ? 'width' : 'height'} 200ms ease-in-out, opacity 200ms ease-in-out, transform 200ms ease-in-out`
                ),
              'will-change':
                isDragging() ?
                  layout() === 'vertical' ?
                    'width'
                  : 'height'
                : 'auto',
              // Use contain: style instead of layout to avoid breaking absolutely positioned menus
              contain: 'style',
            }}
          >
            <div class='h-full w-full overflow-auto'>{secondPanel()}</div>
          </div>
        </Show>
      </div>
    </div>
  );
}
