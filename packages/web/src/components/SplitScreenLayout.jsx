/**
 * SplitScreenLayout - A resizable split-screen layout component
 * Supports vertical (side-by-side) and horizontal (stacked) orientations
 */

import { createSignal, Show, children as resolveChildren } from 'solid-js';

export default function SplitScreenLayout(props) {
  // props.headerContent - optional content to render on the left side of the toolbar
  // Layout: 'vertical' = side by side, 'horizontal' = stacked
  const [layout, setLayout] = createSignal(props.defaultLayout || 'vertical');
  const [splitRatio, setSplitRatio] = createSignal(props.defaultRatio || 50);
  const [isDragging, setIsDragging] = createSignal(false);
  const [showSecondPanel, setShowSecondPanel] = createSignal(props.showSecondPanel ?? true);

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

  function toggleLayout() {
    setLayout(layout() === 'vertical' ? 'horizontal' : 'vertical');
  }

  function toggleSecondPanel() {
    setShowSecondPanel(!showSecondPanel());
  }

  return (
    <div class='flex flex-col h-full'>
      {/* Combined header and layout controls */}
      <div class='bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0'>
        {/* Left side: header content from parent */}
        <div class='flex items-center gap-3 min-w-0'>{props.headerContent}</div>

        {/* Right side: layout controls */}
        <div class='flex items-center gap-2 shrink-0'>
          {/* Toggle second panel */}
          <button
            onClick={toggleSecondPanel}
            class={`p-1.5 rounded transition-colors ${
              showSecondPanel() ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={showSecondPanel() ? 'Hide PDF viewer' : 'Show PDF viewer'}
          >
            <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
              />
            </svg>
          </button>

          <Show when={showSecondPanel()}>
            <div class='h-4 w-px bg-gray-300 mx-1' />

            {/* Vertical split (side by side) */}
            <button
              onClick={() => setLayout('vertical')}
              class={`p-1.5 rounded transition-colors ${
                layout() === 'vertical' ?
                  'bg-blue-100 text-blue-700'
                : 'hover:bg-gray-100 text-gray-600'
              }`}
              title='Side by side'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2'
                />
              </svg>
            </button>

            {/* Horizontal split (stacked) */}
            <button
              onClick={() => setLayout('horizontal')}
              class={`p-1.5 rounded transition-colors ${
                layout() === 'horizontal' ?
                  'bg-blue-100 text-blue-700'
                : 'hover:bg-gray-100 text-gray-600'
              }`}
              title='Stacked'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M4 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z'
                />
              </svg>
            </button>

            {/* Reset ratio */}
            <button
              onClick={() => setSplitRatio(50)}
              class='p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors'
              title='Reset split (50/50)'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                />
              </svg>
            </button>
          </Show>
        </div>
      </div>

      {/* Split content area */}
      <div
        ref={containerRef}
        class={`flex-1 flex overflow-hidden ${
          layout() === 'vertical' ? 'flex-row' : 'flex-col'
        } ${isDragging() ? 'select-none' : ''}`}
      >
        {/* First panel */}
        <div
          class='overflow-auto'
          style={{
            [layout() === 'vertical' ? 'width' : 'height']:
              showSecondPanel() ? `${splitRatio()}%` : '100%',
          }}
        >
          {firstPanel()}
        </div>

        {/* Divider / Resize handle */}
        <Show when={showSecondPanel() && secondPanel()}>
          <div
            onMouseDown={handleMouseDown}
            class={`
              ${layout() === 'vertical' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
              bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors shrink-0
              ${isDragging() ? 'bg-blue-500' : ''}
            `}
          />

          {/* Second panel */}
          <div
            class='overflow-auto'
            style={{
              [layout() === 'vertical' ? 'width' : 'height']: `${100 - splitRatio()}%`,
            }}
          >
            {secondPanel()}
          </div>
        </Show>
      </div>
    </div>
  );
}
