import * as combobox from '@zag-js/combobox';
import { Portal } from 'solid-js/web';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createSignal, createUniqueId, For, Show, splitProps } from 'solid-js';
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
export function Combobox(props) {
  const [local, machineProps] = splitProps(props, [
    'items',
    'label',
    'placeholder',
    'inDialog',
    'class',
    'inputClass',
  ]);

  const getItems = () => local.items || [];
  const [options, setOptions] = createSignal(getItems());

  const collection = createMemo(() =>
    combobox.collection({
      items: options(),
      itemToValue: item => item.value,
      itemToString: item => item.label,
      itemToDisabled: item => item.disabled,
    }),
  );

  const service = useMachine(combobox.machine, () => ({
    id: createUniqueId(),
    openOnClick: true,
    ...machineProps,
    get collection() {
      return collection();
    },
    onOpenChange() {
      setOptions(getItems());
    },
    onInputValueChange({ inputValue }) {
      const items = getItems();
      const filtered = items.filter(item =>
        item.label.toLowerCase().includes(inputValue.toLowerCase()),
      );
      setOptions(filtered.length > 0 ? filtered : items);
    },
  }));

  const api = createMemo(() => combobox.connect(service, normalizeProps));

  const content = () => (
    <div {...api().getPositionerProps()}>
      <Show when={options().length > 0}>
        <ul
          {...api().getContentProps()}
          class={`${Z_INDEX.COMBOBOX} max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none`}
        >
          <For each={options()}>
            {item => (
              <li
                {...api().getItemProps({ item })}
                class='flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-gray-50'
              >
                <span {...api().getItemTextProps({ item })}>{item.label}</span>
                <Show when={api().getItemState({ item }).selected}>
                  <FiCheck class='h-4 w-4 text-blue-600' />
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );

  return (
    <div {...api().getRootProps()} class={`w-full ${local.class || ''}`}>
      <Show when={local.label}>
        <label {...api().getLabelProps()} class='mb-1 block text-sm font-medium text-gray-700'>
          {local.label}
        </label>
      </Show>
      <div
        {...api().getControlProps()}
        class='relative flex items-center rounded-lg border border-gray-300 bg-white data-disabled:cursor-not-allowed data-disabled:bg-gray-100 data-focus:border-blue-500 data-focus:ring-1 data-focus:ring-blue-500 data-invalid:border-red-500'
      >
        <input
          {...api().getInputProps()}
          placeholder={local.placeholder}
          class={`flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-gray-400 disabled:cursor-not-allowed ${local.inputClass || ''}`}
        />
        <Show when={api().hasSelectedItems}>
          <button
            {...api().getClearTriggerProps()}
            class='mr-1 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'
          >
            <FiX class='h-4 w-4' />
          </button>
        </Show>
        <button
          {...api().getTriggerProps()}
          class='px-2 py-2 text-gray-400 transition-colors hover:text-gray-600 data-disabled:cursor-not-allowed data-disabled:opacity-50'
        >
          <FiChevronDown class='h-4 w-4 transition-transform data-[state=open]:rotate-180' />
        </button>
      </div>
      <Show when={api().open}>
        <Show when={!local.inDialog} fallback={content()}>
          <Portal>{content()}</Portal>
        </Show>
      </Show>
    </div>
  );
}

export default Combobox;
