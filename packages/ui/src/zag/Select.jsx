/**
 * Select - A custom select/dropdown component using Ark UI
 */

import { Select, createListCollection } from '@ark-ui/solid/select';
import { Portal } from 'solid-js/web';
import { createMemo, Show, Index } from 'solid-js';
import { BiRegularCheck, BiRegularChevronDown } from 'solid-icons/bi';

/**
 * Select - A custom select/dropdown component
 *
 * Props:
 * - items: Array<{ label: string, value: string, disabled?: boolean }> - Options to display
 * - value: string - The selected value (controlled)
 * - onChange: (value: string) => void - Callback when value changes
 * - label: string - Label text for the select
 * - placeholder: string - Placeholder text when no value selected
 * - disabled: boolean - Whether the select is disabled
 * - name: string - Form input name
 * - invalid: boolean - Whether the select is in an invalid state
 * - disabledValues: string[] - Array of values that should be disabled
 * - inDialog: boolean - Set to true when using inside a Dialog to avoid Portal issues
 */
export default function SelectComponent(props) {
  const items = () => props.items || [];
  const value = () => props.value;
  const placeholder = () => props.placeholder || 'Select option';
  const disabled = () => props.disabled || false;
  const disabledValues = () => props.disabledValues || [];
  const inDialog = () => props.inDialog || false;

  // Create collection from items
  const collection = createMemo(() =>
    createListCollection({
      items: items(),
      itemToString: item => item.label,
      itemToValue: item => item.value,
    }),
  );

  // Convert single value to array for Ark UI
  const selectValue = createMemo(() => {
    const v = value();
    return v ? [v] : [];
  });

  const handleValueChange = details => {
    const newValue = details.value[0] || '';
    // Prevent selecting disabled values
    const item = items().find(i => i.value === newValue);
    if (item?.disabled || disabledValues().includes(newValue)) {
      return;
    }
    props.onChange?.(newValue);
  };

  // Helper to check if a value is disabled
  const isValueDisabled = val => {
    const item = items().find(i => i.value === val);
    return item?.disabled || disabledValues().includes(val);
  };

  // Render content with or without portal
  const renderContent = () => (
    <Select.Positioner class={inDialog() ? 'absolute top-full right-0 left-0 z-10' : ''}>
      <Select.Content class='max-h-60 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg focus:outline-none'>
        <Select.ItemGroup>
          <Index each={items()}>
            {item => {
              const isDisabled = createMemo(() => isValueDisabled(item().value));
              return (
                <Select.Item
                  item={item()}
                  disabled={isDisabled()}
                  class={`flex cursor-pointer items-center justify-between px-3 py-2 whitespace-nowrap hover:bg-gray-100 data-[highlighted]:bg-blue-50 ${
                    isDisabled() ?
                      'cursor-not-allowed text-gray-400 hover:bg-transparent'
                    : 'text-gray-900'
                  }`}
                >
                  <Select.ItemText>{item().label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <BiRegularCheck class='h-5 w-5 text-blue-600' />
                  </Select.ItemIndicator>
                </Select.Item>
              );
            }}
          </Index>
        </Select.ItemGroup>
      </Select.Content>
    </Select.Positioner>
  );

  return (
    <Select.Root
      collection={collection()}
      value={selectValue()}
      onValueChange={handleValueChange}
      disabled={disabled()}
      invalid={props.invalid}
      name={props.name}
      class='relative'
    >
      <Show when={props.label}>
        <Select.Label class='mb-1 block text-sm font-medium text-gray-700'>
          {props.label}
        </Select.Label>
      </Show>

      <Select.Control>
        <Select.Trigger
          class={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
            disabled() ?
              'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500'
            : 'border-gray-300 bg-white hover:border-gray-400'
          } ${props.invalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
        >
          <Select.ValueText placeholder={placeholder()} />
          <Select.Indicator>
            <BiRegularChevronDown class='h-5 w-5 text-gray-400 transition-transform data-[state=open]:rotate-180' />
          </Select.Indicator>
        </Select.Trigger>
      </Select.Control>

      {/* When inside a dialog, don't use Portal to avoid focus trap issues */}
      <Show when={inDialog()} fallback={<Portal>{renderContent()}</Portal>}>
        {renderContent()}
      </Show>

      <Select.HiddenSelect />
    </Select.Root>
  );
}

export { SelectComponent as Select };
