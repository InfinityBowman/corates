/**
 * Progress - Linear progress bar using Ark UI
 */

import { Progress } from '@ark-ui/solid/progress';
import { Component, Show, splitProps, createMemo } from 'solid-js';

export interface ProgressProps {
  /** Current progress value */
  value?: number;
  /** Minimum value (default: 0) */
  min?: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Accessible label */
  label?: string;
  /** Show percentage value (default: false) */
  showValue?: boolean;
  /** Bar height (default: 'md') */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant (default: 'default') */
  variant?: 'default' | 'success' | 'warning' | 'error';
  /** Show indeterminate animation */
  indeterminate?: boolean;
  /** Additional class for root element */
  class?: string;
}

/**
 * Progress - Linear progress bar
 */
const ProgressComponent: Component<ProgressProps> = props => {
  const [local, machineProps] = splitProps(props, [
    'label',
    'showValue',
    'size',
    'variant',
    'indeterminate',
    'class',
  ]);

  const getSizeClass = () => {
    switch (local.size) {
      case 'sm':
        return 'h-1';
      case 'lg':
        return 'h-3';
      default:
        return 'h-2';
    }
  };

  const getVariantClass = () => {
    switch (local.variant) {
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  // For indeterminate, set value to undefined
  const progressValue = createMemo(() => {
    if (local.indeterminate) return undefined;
    return machineProps.value;
  });

  return (
    <Progress.Root
      value={progressValue()}
      min={machineProps.min ?? 0}
      max={machineProps.max ?? 100}
      class={`w-full ${local.class || ''}`}
    >
      <Show when={local.label || local.showValue}>
        <div class='mb-1 flex items-center justify-between'>
          <Show when={local.label}>
            <Progress.Label class='text-sm font-medium text-gray-700'>{local.label}</Progress.Label>
          </Show>
          <Show when={local.showValue && !local.indeterminate}>
            <Progress.ValueText class='text-sm text-gray-500' />
          </Show>
        </div>
      </Show>
      <Progress.Track class={`w-full overflow-hidden rounded-full bg-gray-200 ${getSizeClass()}`}>
        <Progress.Range
          class={`h-full rounded-full transition-all duration-300 ${getVariantClass()} ${
            local.indeterminate ? 'animate-progress-indeterminate' : ''
          }`}
          style={local.indeterminate ? { width: '30%' } : undefined}
        />
      </Progress.Track>
    </Progress.Root>
  );
};

export { ProgressComponent as Progress };
