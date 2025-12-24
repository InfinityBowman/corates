/**
 * Progress - Linear progress bar using Ark UI
 */

import { Progress } from '@ark-ui/solid/progress';
import { Show, splitProps, createMemo } from 'solid-js';

/**
 * Progress - Linear progress bar
 *
 * Props:
 * - value: number - Current progress value
 * - min: number - Minimum value (default: 0)
 * - max: number - Maximum value (default: 100)
 * - label: string - Accessible label
 * - showValue: boolean - Show percentage value (default: false)
 * - size: 'sm' | 'md' | 'lg' - Bar height (default: 'md')
 * - variant: 'default' | 'success' | 'warning' | 'error' - Color variant (default: 'default')
 * - indeterminate: boolean - Show indeterminate animation
 * - class: string - Additional class for root element
 */
export function ProgressComponent(props) {
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
}

export { ProgressComponent as Progress };
export default ProgressComponent;
