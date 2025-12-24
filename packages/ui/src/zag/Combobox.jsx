/**
 * Combobox - Searchable select with autocomplete using Ark UI
 */

import { Combobox, useListCollection } from '@ark-ui/solid/combobox';
import { useFilter } from '@ark-ui/solid/locale';
import { Portal } from 'solid-js/web';
import { createMemo, createSignal, Show, splitProps, Index } from 'solid-js';
import { FiChevronDown, FiX, FiCheck } from 'solid-icons/fi';
import { Z_INDEX } from '../constants/zIndex.js';

/**
 * Combobox - Searchable select with autocomplete
 *
 * Props:
 * - items: Array<{ value: string, label: string, disabled?: boolean }> - Available items
 * - label: string - Input label
 * - placeholder: string - Input placeholder
 * - value: string[] - Controlled selected values
 * - defaultValue: string[] - Initial selected values
 * - onValueChange: (details: { value: string[], items: Item[] }) => void - Callback when selection changes
 * - onInputValueChange: (details: { inputValue: string }) => void - Callback when input changes
 * - multiple: boolean - Allow multiple selections (default: false)
 * - disabled: boolean - Disable the combobox
 * - readOnly: boolean - Make combobox read-only
 * - invalid: boolean - Mark as invalid
 * - name: string - Form field name
 * - allowCustomValue: boolean - Allow custom values not in the list
 * - closeOnSelect: boolean - Close on selection (default: true for single, false for multiple)
 * - openOnClick: boolean - Open on input click (default: true)
 * - inDialog: boolean - Set to true when used inside a Dialog
 * - class: string - Additional class for root element
 * - inputClass: string - Additional class for input element
 */
export function ComboboxComponent(props) {
  const [local, machineProps] = splitProps(props, [
    'items',
    'label',
    'placeholder',
    'inDialog',
    'class',
    'inputClass',
  ]);

  const getItems = () => local.items || [];

  // Use Ark UI's filter utility
  const filterFn = useFilter({ sensitivity: 'base' });

  // Create collection with filtering
  const { collection, filter } = useListCollection({
    initialItems: getItems(),
    filter: filterFn().contains,
    itemToString: item => item.label,
    itemToValue: item => item.value,
    itemToDisabled: item => item.disabled,
  });

  const handleInputValueChange = details => {
    filter(details.inputValue);
    if (machineProps.onInputValueChange) {
      machineProps.onInputValueChange(details);
    }
  };

  const handleValueChange = details => {
    if (machineProps.onValueChange) {
      machineProps.onValueChange(details);
    }
  };

  // Track open state for conditional rendering
  const [isOpen, setIsOpen] = createSignal(false);

  const handleOpenChange = details => {
    setIsOpen(details.open);
    if (machineProps.onOpenChange) {
      machineProps.onOpenChange(details);
    }
  };

  // Check if there are selected items
  const hasSelectedItems = createMemo(() => {
    const value = machineProps.value || machineProps.defaultValue || [];
    return value.length > 0;
  });

  const renderContent = () => (
    <Combobox.Positioner>
      <Show when={collection().items.length > 0}>
        <Combobox.Content
          class={`${Z_INDEX.COMBOBOX} max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none`}
        >
          <Combobox.ItemGroup>
            <Index each={collection().items}>
              {item => {
                const itemValue = item();
                return (
                  <Combobox.Item
                    item={itemValue}
                    class='flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-gray-50'
                  >
                    <Combobox.ItemText>{itemValue.label}</Combobox.ItemText>
                    <Combobox.ItemIndicator>
                      <FiCheck class='h-4 w-4 text-blue-600' />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                );
              }}
            </Index>
          </Combobox.ItemGroup>
        </Combobox.Content>
      </Show>
    </Combobox.Positioner>
  );

  return (
    <Combobox.Root
      collection={collection()}
      value={machineProps.value}
      defaultValue={machineProps.defaultValue}
      onValueChange={handleValueChange}
      onInputValueChange={handleInputValueChange}
      onOpenChange={handleOpenChange}
      multiple={machineProps.multiple}
      disabled={machineProps.disabled}
      readOnly={machineProps.readOnly}
      invalid={machineProps.invalid}
      name={machineProps.name}
      allowCustomValue={machineProps.allowCustomValue}
      closeOnSelect={machineProps.closeOnSelect}
      openOnClick={machineProps.openOnClick ?? true}
      class={`w-full ${local.class || ''}`}
    >
      <Show when={local.label}>
        <Combobox.Label class='mb-1 block text-sm font-medium text-gray-700'>
          {local.label}
        </Combobox.Label>
      </Show>
      <Combobox.Control class='relative flex items-center rounded-lg border border-gray-300 bg-white data-[disabled]:cursor-not-allowed data-[disabled]:bg-gray-100 data-[focus]:border-blue-500 data-[focus]:ring-1 data-[focus]:ring-blue-500 data-[invalid]:border-red-500'>
        <Combobox.Input
          placeholder={local.placeholder}
          class={`flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-gray-400 disabled:cursor-not-allowed ${local.inputClass || ''}`}
        />
        <Show when={hasSelectedItems()}>
          <Combobox.ClearTrigger class='mr-1 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'>
            <FiX class='h-4 w-4' />
          </Combobox.ClearTrigger>
        </Show>
        <Combobox.Trigger class='px-2 py-2 text-gray-400 transition-colors hover:text-gray-600 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'>
          <FiChevronDown class='h-4 w-4 transition-transform data-[state=open]:rotate-180' />
        </Combobox.Trigger>
      </Combobox.Control>
      <Show when={isOpen()}>
        <Show when={!local.inDialog} fallback={renderContent()}>
          <Portal>{renderContent()}</Portal>
        </Show>
      </Show>
    </Combobox.Root>
  );
}

export { ComboboxComponent as Combobox };
export default ComboboxComponent;
