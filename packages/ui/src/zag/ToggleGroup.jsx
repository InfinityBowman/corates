import * as toggle from '@zag-js/toggle-group';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, For, splitProps } from 'solid-js';

/**
 * ToggleGroup - Group of toggle buttons
 *
 * Props:
 * - items: Array<{ value: string, label: JSX.Element, disabled?: boolean }> - Toggle items
 * - value: string[] - Controlled selected values
 * - defaultValue: string[] - Initial selected values
 * - onValueChange: (details: { value: string[] }) => void - Callback when selection changes
 * - multiple: boolean - Allow multiple selections (default: false)
 * - disabled: boolean - Disable all toggles
 * - orientation: 'horizontal' | 'vertical' - Layout orientation (default: 'horizontal')
 * - loop: boolean - Loop focus navigation (default: true)
 * - rovingFocus: boolean - Use roving tabindex (default: true)
 * - deselectable: boolean - Allow deselecting when single (default: true)
 * - size: 'sm' | 'md' | 'lg' - Button size (default: 'md')
 * - class: string - Additional class for root element
 */
export function ToggleGroup(props) {
  const [local, machineProps] = splitProps(props, ['items', 'size', 'class']);

  const service = useMachine(toggle.machine, () => ({
    ...machineProps,
    id: createUniqueId(),
    orientation: 'horizontal',
    loop: true,
    rovingFocus: true,
    deselectable: true,
  }));

  const api = createMemo(() => toggle.connect(service, normalizeProps));

  const getSizeClass = () => {
    switch (local.size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-2.5 text-base';
      default:
        return 'px-3 py-1.5 text-sm';
    }
  };

  const isVertical = () => api().orientation === 'vertical';

  return (
    <div
      {...api().getRootProps()}
      class={`inline-flex ${isVertical() ? 'flex-col' : 'flex-row'} rounded-lg border border-gray-200 overflow-hidden ${local.class || ''}`}
    >
      <For each={local.items}>
        {(item, index) => (
          <button
            {...api().getItemProps({ value: item.value, disabled: item.disabled })}
            class={`${getSizeClass()} font-medium transition-colors
              bg-white text-gray-700
              hover:bg-gray-50
              data-[state=on]:bg-blue-50 data-[state=on]:text-blue-700
              data-focus:ring-2 data-focus:ring-blue-500 data-focus:ring-inset data-focus:z-10
              data-disabled:opacity-50 data-disabled:cursor-not-allowed
              ${!isVertical() && index() > 0 ? 'border-l border-gray-200' : ''}
              ${isVertical() && index() > 0 ? 'border-t border-gray-200' : ''}`}
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
  );
}

export default ToggleGroup;
