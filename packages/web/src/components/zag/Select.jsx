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

  const collection = createMemo(() =>
    select.collection({
      items: items(),
      itemToString: item => item.label,
      itemToValue: item => item.value,
      itemToDisabled: item => item.disabled || disabledValues().includes(item.value),
    }),
  );

  const service = useMachine(select.machine, () => ({
    id: createUniqueId(),
    collection: collection(),
    value: value() ? [value()] : [],
    disabled: disabled(),
    name: props.name,
    invalid: props.invalid,
    onValueChange(details) {
      const newValue = details.value[0] || '';
      props.onChange?.(newValue);
    },
  }));

  const api = createMemo(() => select.connect(service, normalizeProps));

  const selectedLabel = createMemo(() => {
    const v = value();
    if (!v) return null;
    const item = items().find(i => i.value === v);
    return item?.label || null;
  });

  return (
    <div {...api().getRootProps()} class='relative'>
      <Show when={props.label}>
        <label {...api().getLabelProps()} class='block text-sm font-medium text-gray-700 mb-1'>
          {props.label}
        </label>
      </Show>

      <div {...api().getControlProps()}>
        <button
          type='button'
          {...api().getTriggerProps()}
          class={`
            w-full flex items-center justify-between px-3 py-2 
            border rounded-md shadow-sm text-left
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            transition-colors
            ${disabled() ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-white border-gray-300 hover:border-gray-400'}
            ${props.invalid ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
          `}
        >
          <span class={selectedLabel() ? 'text-gray-900' : 'text-gray-500'}>
            {selectedLabel() || placeholder()}
          </span>
          <BiRegularChevronDown
            class={`w-5 h-5 text-gray-400 transition-transform ${api().open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* When inside a dialog, don't use Portal to avoid focus trap issues */}
      <Show
        when={inDialog()}
        fallback={
          <Portal>
            <div {...api().getPositionerProps()} class='z-100'>
              <ul
                {...api().getContentProps()}
                class='bg-white border border-gray-200 rounded-md shadow-lg py-1 max-h-60 overflow-auto focus:outline-none'
              >
                <For each={items()}>
                  {item => {
                    const itemDisabled = () =>
                      item.disabled || disabledValues().includes(item.value);
                    return (
                      <li
                        {...api().getItemProps({ item })}
                        class={`
                          px-3 py-2 cursor-pointer flex items-center justify-between
                          hover:bg-gray-100 data-highlighted:bg-blue-50
                          ${itemDisabled() ? 'text-gray-400 cursor-not-allowed hover:bg-transparent' : 'text-gray-900'}
                        `}
                      >
                        <span {...api().getItemTextProps({ item })}>{item.label}</span>
                        <Show when={api().value.includes(item.value)}>
                          <BiRegularCheck class='w-5 h-5 text-blue-600' />
                        </Show>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </div>
          </Portal>
        }
      >
        <div
          {...api().getPositionerProps()}
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, 'z-index': 100 }}
        >
          <ul
            {...api().getContentProps()}
            class='bg-white border border-gray-200 rounded-md shadow-lg py-1 max-h-60 overflow-auto focus:outline-none'
          >
            <For each={items()}>
              {item => {
                const itemDisabled = () => item.disabled || disabledValues().includes(item.value);
                return (
                  <li
                    {...api().getItemProps({ item })}
                    class={`
                      px-3 py-2 cursor-pointer flex items-center justify-between whitespace-nowrap
                      hover:bg-gray-100 data-highlighted:bg-blue-50
                      ${itemDisabled() ? 'text-gray-400 cursor-not-allowed hover:bg-transparent' : 'text-gray-900'}
                    `}
                  >
                    <span {...api().getItemTextProps({ item })}>{item.label}</span>
                    <Show when={api().value.includes(item.value)}>
                      <BiRegularCheck class='w-5 h-5 text-blue-600' />
                    </Show>
                  </li>
                );
              }}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
}
