import * as combobox from '@zag-js/combobox';
import { Portal } from 'solid-js/web';
import { normalizeProps, useMachine } from '@zag-js/solid';
import {
  createMemo,
  createSignal,
  createUniqueId,
  For,
  Show,
  splitProps,
  mergeProps,
} from 'solid-js';
import { FiChevronDown, FiX, FiCheck } from 'solid-icons/fi';

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

  const context = mergeProps(machineProps, {
    id: createUniqueId(),
    openOnClick: true,
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
  });

  const service = useMachine(combobox.machine, context);

  const api = createMemo(() => combobox.connect(service, normalizeProps));

  const content = () => (
    <div {...api().getPositionerProps()}>
      <Show when={options().length > 0}>
        <ul
          {...api().getContentProps()}
          class='bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-60 overflow-auto z-50 focus:outline-none'
        >
          <For each={options()}>
            {item => (
              <li
                {...api().getItemProps({ item })}
                class='flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors text-gray-700 hover:bg-gray-50 data-highlighted:bg-gray-50 data-disabled:opacity-50 data-disabled:cursor-not-allowed'
              >
                <span {...api().getItemTextProps({ item })}>{item.label}</span>
                <Show when={api().getItemState({ item }).selected}>
                  <FiCheck class='w-4 h-4 text-blue-600' />
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
        <label {...api().getLabelProps()} class='block text-sm font-medium text-gray-700 mb-1'>
          {local.label}
        </label>
      </Show>
      <div
        {...api().getControlProps()}
        class='relative flex items-center border border-gray-300 rounded-lg bg-white data-focus:border-blue-500 data-focus:ring-1 data-focus:ring-blue-500 data-invalid:border-red-500 data-disabled:bg-gray-100 data-disabled:cursor-not-allowed'
      >
        <input
          {...api().getInputProps()}
          placeholder={local.placeholder}
          class={`flex-1 px-3 py-2 bg-transparent outline-none text-sm placeholder:text-gray-400 disabled:cursor-not-allowed ${local.inputClass || ''}`}
        />
        <Show when={api().hasSelectedItems}>
          <button
            {...api().getClearTriggerProps()}
            class='p-1 mr-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors'
          >
            <FiX class='w-4 h-4' />
          </button>
        </Show>
        <button
          {...api().getTriggerProps()}
          class='px-2 py-2 text-gray-400 hover:text-gray-600 transition-colors data-disabled:opacity-50 data-disabled:cursor-not-allowed'
        >
          <FiChevronDown class='w-4 h-4 transition-transform data-[state=open]:rotate-180' />
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
