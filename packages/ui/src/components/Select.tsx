/**
 * Select component using Ark UI
 *
 * Supports both high-level convenience API and low-level composition API
 */

import { Select as ArkSelect, createListCollection, useSelect } from '@ark-ui/solid/select';
import { Portal } from 'solid-js/web';
import { Component, createMemo, Show, Index, splitProps, mergeProps } from 'solid-js';
import { BiRegularCheck, BiRegularChevronDown } from 'solid-icons/bi';
import { Z_INDEX } from '../constants/zIndex';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps {
  /** Options to display */
  items: SelectOption[];
  /** The selected value (controlled) */
  value?: string;
  /** Callback when value changes */
  onChange?: (_value: string) => void;
  /** Label text for the select */
  label?: string;
  /** Placeholder text when no value selected (default: 'Select option') */
  placeholder?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Form input name */
  name?: string;
  /** Whether the select is in an invalid state */
  invalid?: boolean;
  /** Array of values that should be disabled */
  disabledValues?: string[];
  /** Whether the value can be cleared by clicking the selected item */
  deselectable?: boolean;
  /** Whether the select should close after an item is selected (default: true) */
  closeOnSelect?: boolean;
  /** Whether to allow multiple selection */
  multiple?: boolean;
  /** Positioning options for the dropdown menu */
  positioning?: {
    placement?: string;
    sameWidth?: boolean;
    [key: string]: unknown;
  };
  /** Set to true when used inside a Dialog or Popover */
  inDialog?: boolean;
  /** Additional props to pass to Select.Root (e.g., open, onOpenChange, etc.) */
  arkProps?: Record<string, unknown>;
}

/**
 * Select - Reusable select/dropdown component using Ark UI
 */
const SelectComponent: Component<SelectProps> = props => {
  // Split convenience props from Ark UI props
  const [local, arkProps] = splitProps(props, [
    'items',
    'value',
    'onChange',
    'label',
    'placeholder',
    'disabledValues',
    'deselectable',
    'closeOnSelect',
    'multiple',
    'positioning',
    'inDialog',
  ]);

  // Merge default values
  const merged = mergeProps(
    {
      items: [],
      placeholder: 'Select option',
      disabled: false,
      disabledValues: [],
      deselectable: false,
      closeOnSelect: true,
      multiple: false,
      invalid: false,
      inDialog: false,
    },
    props,
  );

  const items = () => props.items || [];
  // Access value reactively from props to maintain reactivity
  const value = () => props.value;
  const disabledValues = createMemo(() => props.disabledValues || []);
  const placeholder = () => props.placeholder || merged.placeholder;
  const disabled = () => merged.disabled;
  const invalid = () => merged.invalid;
  const inDialog = () => merged.inDialog;

  // Create collection from items with disabled handling
  const collection = createMemo(() => {
    const collectionItems = items().map(item => ({
      ...item,
      disabled: item.disabled || disabledValues().includes(item.value),
    }));

    return createListCollection({
      items: collectionItems,
      itemToString: (item: SelectOption) => item.label,
      itemToValue: (item: SelectOption) => item.value,
    });
  });

  // Convert single value to array for Ark UI (or use array directly for multiple)
  // Access value reactively to ensure proper tracking
  const selectValue = createMemo(() => {
    const v = value();
    if (merged.multiple) {
      return (
        Array.isArray(v) ? v
        : v != null ? [v]
        : []
      );
    }
    // For single select: return empty array if value is null/undefined, otherwise [value]
    // Empty string is valid (for "Unassigned" option)
    return v != null ? [v] : [];
  });

  // Handle value change - convert array back to single value for single select
  const handleValueChange = (details: { value: string[] }) => {
    if (!local.onChange) return;

    if (merged.multiple) {
      local.onChange(details.value as unknown as string);
    } else {
      const newValue = details.value[0] || '';
      // Prevent selecting disabled values
      const currentCollection = collection();
      const item = currentCollection.items.find(i => i.value === newValue);
      if (item?.disabled || disabledValues().includes(newValue)) {
        return;
      }
      local.onChange(newValue);
    }
  };

  // Helper to check if a value is disabled
  const isValueDisabled = (val: string) => {
    const currentCollection = collection();
    const item = currentCollection.items.find(i => i.value === val);
    const disabledSet = new Set(disabledValues());
    return item?.disabled || disabledSet.has(val);
  };

  // Get positioning options - use provided or default
  const positioningOptions = (): {
    placement?: string;
    sameWidth?: boolean;
    gutter?: number;
    [key: string]: unknown;
  } => {
    const defaultPos = {
      placement: 'bottom-start',
      sameWidth: true,
      gutter: 4,
    };
    if (!local.positioning) return defaultPos;
    return {
      ...defaultPos,
      ...local.positioning,
      placement: local.positioning.placement ?? defaultPos.placement,
      sameWidth: local.positioning.sameWidth ?? defaultPos.sameWidth,
      gutter:
        typeof local.positioning.gutter === 'number' ? local.positioning.gutter : defaultPos.gutter,
    };
  };

  return (
    <ArkSelect.Root
      collection={collection()}
      value={selectValue()}
      onValueChange={handleValueChange}
      deselectable={merged.deselectable}
      closeOnSelect={merged.closeOnSelect}
      multiple={merged.multiple}
      positioning={
        positioningOptions() as unknown as Parameters<typeof ArkSelect.Root>[0]['positioning']
      }
      disabled={disabled()}
      invalid={invalid()}
      {...arkProps}
    >
      <Show when={local.label}>
        <ArkSelect.Label class='mb-1.5 block text-sm leading-none font-medium text-gray-900'>
          {local.label}
        </ArkSelect.Label>
      </Show>

      <ArkSelect.Control>
        <ArkSelect.Trigger
          class={`flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm text-gray-900 ring-offset-white transition-colors placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
            disabled() ?
              'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500'
            : 'border-gray-300 hover:bg-gray-50'
          } ${invalid() ? 'border-red-500 focus:ring-red-500' : ''}`}
        >
          <ArkSelect.ValueText placeholder={placeholder()} />
          <ArkSelect.Indicator>
            <BiRegularChevronDown class='h-4 w-4 text-gray-500 opacity-50 transition-transform duration-200' />
          </ArkSelect.Indicator>
        </ArkSelect.Trigger>
      </ArkSelect.Control>

      {inDialog() ?
        <ArkSelect.Positioner>
          <ArkSelect.Content
            class={`${Z_INDEX.SELECT} max-h-96 min-w-32 overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-md focus:outline-none`}
          >
            <ArkSelect.ItemGroup>
              <Index each={collection().items}>
                {item => {
                  const isDisabled = () => isValueDisabled(item().value);
                  return (
                    <ArkSelect.Item
                      item={item()}
                      class={`relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm transition-colors outline-none select-none hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-gray-100 ${
                        isDisabled() ? 'pointer-events-none opacity-50' : 'text-gray-900'
                      }`}
                    >
                      <ArkSelect.ItemText class='flex-1'>{item().label}</ArkSelect.ItemText>
                      <ArkSelect.ItemIndicator class='absolute right-2 flex h-3.5 w-3.5 items-center justify-center'>
                        <BiRegularCheck class='h-4 w-4 text-blue-600' />
                      </ArkSelect.ItemIndicator>
                    </ArkSelect.Item>
                  );
                }}
              </Index>
            </ArkSelect.ItemGroup>
          </ArkSelect.Content>
        </ArkSelect.Positioner>
      : <Portal>
          <ArkSelect.Positioner>
            <ArkSelect.Content
              class={`${Z_INDEX.SELECT} max-h-96 min-w-32 overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-md focus:outline-none`}
            >
              <ArkSelect.ItemGroup>
                <Index each={collection().items}>
                  {item => {
                    const isDisabled = () => isValueDisabled(item().value);
                    return (
                      <ArkSelect.Item
                        item={item()}
                        class={`relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm transition-colors outline-none select-none hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-gray-100 ${
                          isDisabled() ? 'pointer-events-none opacity-50' : 'text-gray-900'
                        }`}
                      >
                        <ArkSelect.ItemText class='flex-1'>{item().label}</ArkSelect.ItemText>
                        <ArkSelect.ItemIndicator class='absolute right-2 flex h-3.5 w-3.5 items-center justify-center'>
                          <BiRegularCheck class='h-4 w-4 text-blue-600' />
                        </ArkSelect.ItemIndicator>
                      </ArkSelect.Item>
                    );
                  }}
                </Index>
              </ArkSelect.ItemGroup>
            </ArkSelect.Content>
          </ArkSelect.Positioner>
        </Portal>
      }

      <ArkSelect.HiddenSelect />
    </ArkSelect.Root>
  );
};

export default SelectComponent;

// Export hook for programmatic control
export { useSelect };

// Export raw Ark UI primitive for custom layouts
export { ArkSelect as SelectPrimitive };

// Export component
export { SelectComponent as Select };
