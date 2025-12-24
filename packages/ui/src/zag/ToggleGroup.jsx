/**
 * ToggleGroup - Group of toggle buttons using Ark UI
 */

import { ToggleGroup } from '@ark-ui/solid/toggle-group';
import { For, splitProps, createMemo } from 'solid-js';

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
export function ToggleGroupComponent(props) {
  const [local, machineProps] = splitProps(props, ['items', 'size', 'class']);

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

  const orientation = () => machineProps.orientation || 'horizontal';
  const isVertical = createMemo(() => orientation() === 'vertical');

  const handleValueChange = (details) => {
    if (machineProps.onValueChange) {
      machineProps.onValueChange(details);
    }
  };

  return (
    <ToggleGroup.Root
      value={machineProps.value}
      defaultValue={machineProps.defaultValue}
      onValueChange={handleValueChange}
      multiple={machineProps.multiple}
      disabled={machineProps.disabled}
      orientation={orientation()}
      loopFocus={machineProps.loop ?? true}
      rovingFocus={machineProps.rovingFocus ?? true}
      deselectable={machineProps.deselectable ?? true}
      class={`inline-flex ${isVertical() ? 'flex-col' : 'flex-row'} overflow-hidden rounded-lg border border-gray-200 ${local.class || ''}`}
    >
      <For each={local.items}>
        {(item, index) => (
          <ToggleGroup.Item
            value={item.value}
            disabled={item.disabled}
            class={`${getSizeClass()} bg-white font-medium text-gray-700 transition-colors hover:bg-gray-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[focus]:z-10 data-[focus]:ring-2 data-[focus]:ring-blue-500 data-[focus]:ring-inset data-[state=on]:bg-blue-50 data-[state=on]:text-blue-700 ${
              !isVertical() && index() > 0 ? 'border-l border-gray-200' : ''
            } ${isVertical() && index() > 0 ? 'border-t border-gray-200' : ''}`}
          >
            {item.label}
          </ToggleGroup.Item>
        )}
      </For>
    </ToggleGroup.Root>
  );
}

export { ToggleGroupComponent as ToggleGroup };
export default ToggleGroupComponent;
