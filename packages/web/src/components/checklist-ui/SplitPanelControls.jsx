/**
 * SplitPanelControls - Toolbar controls for split panel layout
 * Used by SplitScreenLayout to provide consistent UI for toggling/configuring panels
 */

import { Show } from 'solid-js';
import { AiOutlineFilePdf } from 'solid-icons/ai';
import { VsSplitHorizontal, VsSplitVertical } from 'solid-icons/vs';
import { VsRefresh } from 'solid-icons/vs';

export default function SplitPanelControls(props) {
  // props.showSecondPanel - boolean, whether second panel is visible
  // props.onToggleSecondPanel - callback to toggle second panel
  // props.layout - 'vertical' or 'horizontal'
  // props.onSetLayout - callback to set layout
  // props.onResetRatio - callback to reset split ratio
  // props.secondPanelLabel - label for the toggle button (e.g., "PDF viewer")
  // props.defaultRatioLabel - label for reset button (e.g., "50/50" or "60/40")

  const panelLabel = () => props.secondPanelLabel || 'second panel';
  const ratioLabel = () => props.defaultRatioLabel || '50/50';

  return (
    <div class='flex shrink-0 items-center gap-2'>
      {/* Toggle second panel */}
      <button
        onClick={() => props.onToggleSecondPanel?.()}
        class={`rounded p-1.5 transition-colors ${
          props.showSecondPanel ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
        }`}
        title={props.showSecondPanel ? `Hide ${panelLabel()}` : `Show ${panelLabel()}`}
      >
        <AiOutlineFilePdf class='h-5 w-5' />
      </button>

      <Show when={props.showSecondPanel}>
        <div class='mx-1 h-4 w-px bg-gray-300' />

        {/* Vertical split (side by side) */}
        <button
          onClick={() => props.onSetLayout?.('vertical')}
          class={`rounded p-1.5 transition-colors ${
            props.layout === 'vertical' ?
              'bg-blue-100 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100'
          }`}
          title='Side by side'
        >
          <VsSplitHorizontal class='h-5 w-5' />
        </button>

        {/* Horizontal split (stacked) */}
        <button
          onClick={() => props.onSetLayout?.('horizontal')}
          class={`rounded p-1.5 transition-colors ${
            props.layout === 'horizontal' ?
              'bg-blue-100 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100'
          }`}
          title='Stacked'
        >
          <VsSplitVertical class='h-5 w-5' />
        </button>

        {/* Reset ratio */}
        <button
          onClick={() => props.onResetRatio?.()}
          class='rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100'
          title={`Reset split (${ratioLabel()})`}
        >
          <VsRefresh class='h-5 w-5' />
        </button>
      </Show>
    </div>
  );
}
