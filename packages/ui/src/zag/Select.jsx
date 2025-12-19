import * as select from '@zag-js/select';
import { Portal } from 'solid-js/web';
import { useMachine, normalizeProps } from '@zag-js/solid';
import { createMemo, createUniqueId, For, Show } from 'solid-js';
import { BiRegularCheck, BiRegularChevronDown } from 'solid-icons/bi';

/**
 * Select - A custom select/dropdown component using Zag.js
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
export default function Select(props) {
  const items = () => props.items || [];
  const value = () => props.value;
  const placeholder = () => props.placeholder || 'Select option';
  const disabled = () => props.disabled || false;
  const disabledValues = () => props.disabledValues || [];
  const inDialog = () => props.inDialog || false;

  // Helper to check if a value is disabled
  const isValueDisabled = val => {
    const item = items().find(i => i.value === val);
    return item?.disabled || disabledValues().includes(val);
  };

  const collection = createMemo(() =>
    select.collection({
      items: items(),
      itemToString: item => item.label,
      itemToValue: item => item.value,
    }),
  );

  const service = useMachine(select.machine, () => {
    // Capture disabledValues here so it's tracked as a dependency
    const currentDisabledValues = disabledValues();
    const currentItems = items();

    return {
      id: createUniqueId(),
      collection: collection(),
      value: value() ? [value()] : [],
      disabled: disabled(),
      name: props.name,
      invalid: props.invalid,
      onValueChange(details) {
        const newValue = details.value[0] || '';
        // Prevent selecting disabled values
        const item = currentItems.find(i => i.value === newValue);
        if (item?.disabled || currentDisabledValues.includes(newValue)) {
          return;
        }
        props.onChange?.(newValue);
      },
    };
  });

  const api = createMemo(() => select.connect(service, normalizeProps));

  const selectedLabel = createMemo(() => {
    const v = value();
    if (!v) return null;
    const item = items().find(i => i.value === v);
    return item?.label || null;
  });

  // Render the list of items
  const renderList = () => (
    <ul
      {...api().getContentProps()}
      class='max-h-60 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg focus:outline-none'
    >
      <For each={items()}>
        {item => (
          <li
            {...api().getItemProps({ item })}
            class={`flex cursor-pointer items-center justify-between px-3 py-2 whitespace-nowrap hover:bg-gray-100 data-highlighted:bg-blue-50 ${isValueDisabled(item.value) ? 'cursor-not-allowed text-gray-400 hover:bg-transparent' : 'text-gray-900'} `}
            data-disabled={isValueDisabled(item.value) || undefined}
          >
            <span {...api().getItemTextProps({ item })}>{item.label}</span>
            <Show when={api().value.includes(item.value)}>
              <BiRegularCheck class='h-5 w-5 text-blue-600' />
            </Show>
          </li>
        )}
      </For>
    </ul>
  );

  return (
    <div {...api().getRootProps()} class='relative'>
      <Show when={props.label}>
        <label {...api().getLabelProps()} class='mb-1 block text-sm font-medium text-gray-700'>
          {props.label}
        </label>
      </Show>

      <div {...api().getControlProps()}>
        <button
          type='button'
          {...api().getTriggerProps()}
          class={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none ${disabled() ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500' : 'border-gray-300 bg-white hover:border-gray-400'} ${props.invalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} `}
        >
          <span class={selectedLabel() ? 'text-gray-900' : 'text-gray-500'}>
            {selectedLabel() || placeholder()}
          </span>
          <BiRegularChevronDown
            class={`h-5 w-5 text-gray-400 transition-transform ${api().open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* When inside a dialog, don't use Portal to avoid focus trap issues */}
      <Show
        when={inDialog()}
        fallback={
          <Portal>
            <div {...api().getPositionerProps()}>{renderList()}</div>
          </Portal>
        }
      >
        <div
          {...api().getPositionerProps()}
          style={{ position: 'absolute', top: '100%', left: 0, right: 0 }}
        >
          {renderList()}
        </div>
      </Show>
    </div>
  );
}
