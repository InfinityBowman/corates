import * as progress from '@zag-js/progress';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, Show, splitProps } from 'solid-js';

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
export function Progress(props) {
  const [local, machineProps] = splitProps(props, [
    'label',
    'showValue',
    'size',
    'variant',
    'indeterminate',
    'class',
  ]);

  const service = useMachine(progress.machine, () => ({
    ...machineProps,
    id: createUniqueId(),
    min: 0,
    max: 100,
  }));

  const api = createMemo(() => progress.connect(service, normalizeProps));

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

  return (
    <div {...api().getRootProps()} class={`w-full ${local.class || ''}`}>
      <Show when={local.label || local.showValue}>
        <div class='flex items-center justify-between mb-1'>
          <Show when={local.label}>
            <span {...api().getLabelProps()} class='text-sm font-medium text-gray-700'>
              {local.label}
            </span>
          </Show>
          <Show when={local.showValue && !local.indeterminate}>
            <span {...api().getValueTextProps()} class='text-sm text-gray-500'>
              {api().valueAsString}
            </span>
          </Show>
        </div>
      </Show>
      <div
        {...api().getTrackProps()}
        class={`w-full bg-gray-200 rounded-full overflow-hidden ${getSizeClass()}`}
      >
        <div
          {...api().getRangeProps()}
          class={`h-full rounded-full transition-all duration-300 ${getVariantClass()} ${local.indeterminate ? 'animate-progress-indeterminate' : ''}`}
          style={local.indeterminate ? { width: '30%' } : undefined}
        />
      </div>
    </div>
  );
}

export default Progress;
