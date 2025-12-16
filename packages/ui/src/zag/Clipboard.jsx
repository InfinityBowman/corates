import * as clipboard from '@zag-js/clipboard';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, Show, splitProps, mergeProps } from 'solid-js';
import { FiCopy, FiCheck } from 'solid-icons/fi';

/**
 * Clipboard - Copy to clipboard functionality
 *
 * Props:
 * - value: string - Value to copy to clipboard
 * - defaultValue: string - Initial value to copy
 * - onValueChange: (details: { value: string }) => void - Callback when value changes
 * - onStatusChange: (details: { copied: boolean }) => void - Callback when copy status changes
 * - timeout: number - Time in ms before resetting copied state (default: 3000)
 * - label: string - Label for the input
 * - showInput: boolean - Show input field (default: true)
 * - children: (api: ClipboardApi) => JSX.Element - Render function for custom UI
 * - class: string - Additional class for root element
 */
export function Clipboard(props) {
  const [local, machineProps] = splitProps(props, ['label', 'showInput', 'children', 'class']);

  const context = mergeProps(machineProps, {
    id: createUniqueId(),
    timeout: 3000,
  });

  const service = useMachine(clipboard.machine, context);

  const api = createMemo(() => clipboard.connect(service, normalizeProps));

  const showInput = () => local.showInput !== false;

  return (
    <Show when={!local.children} fallback={local.children?.(api)}>
      <div {...api().getRootProps()} class={`w-full ${local.class || ''}`}>
        <Show when={local.label}>
          <label {...api().getLabelProps()} class='block text-sm font-medium text-gray-700 mb-1'>
            {local.label}
          </label>
        </Show>
        <div {...api().getControlProps()} class='flex items-center gap-2'>
          <Show when={showInput()}>
            <input
              {...api().getInputProps()}
              class='flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              readOnly
            />
          </Show>
          <button
            {...api().getTriggerProps()}
            class={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${api().copied ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Show when={api().copied} fallback={<FiCopy class='w-4 h-4' />}>
              <FiCheck class='w-4 h-4' />
            </Show>
            <span>{api().copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </Show>
  );
}

/**
 * CopyButton - Simple copy button without input field
 *
 * Props:
 * - value: string - Value to copy
 * - onStatusChange: (details: { copied: boolean }) => void - Callback when copy status changes
 * - timeout: number - Time in ms before resetting (default: 3000)
 * - label: string - Button label (default: 'Copy')
 * - copiedLabel: string - Label when copied (default: 'Copied!')
 * - size: 'sm' | 'md' | 'lg' - Button size (default: 'md')
 * - variant: 'solid' | 'outline' | 'ghost' - Button variant (default: 'solid')
 * - showIcon: boolean - Show copy/check icon (default: true)
 * - showLabel: boolean - Show text label (default: true)
 * - class: string - Additional class for button
 */
export function CopyButton(props) {
  const [local, machineProps] = splitProps(props, [
    'label',
    'copiedLabel',
    'size',
    'variant',
    'showIcon',
    'showLabel',
    'class',
  ]);

  const context = mergeProps(machineProps, {
    id: createUniqueId(),
    timeout: 3000,
  });

  const service = useMachine(clipboard.machine, context);

  const api = createMemo(() => clipboard.connect(service, normalizeProps));

  const showIcon = () => local.showIcon !== false;
  const showLabel = () => local.showLabel !== false;
  const label = () => local.label || 'Copy';
  const copiedLabel = () => local.copiedLabel || 'Copied!';

  const getSizeClass = () => {
    switch (local.size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-2.5 text-base';
      default:
        return 'px-3 py-2 text-sm';
    }
  };

  const getVariantClass = () => {
    const copied = api().copied;
    switch (local.variant) {
      case 'outline':
        return copied ?
            'border border-green-500 text-green-700 hover:bg-green-50'
          : 'border border-gray-300 text-gray-700 hover:bg-gray-50';
      case 'ghost':
        return copied ? 'text-green-700 hover:bg-green-100' : 'text-gray-700 hover:bg-gray-100';
      default:
        return copied ?
            'bg-green-600 text-white hover:bg-green-700'
          : 'bg-blue-600 text-white hover:bg-blue-700';
    }
  };

  const iconSize = () => {
    switch (local.size) {
      case 'sm':
        return 'w-3 h-3';
      case 'lg':
        return 'w-5 h-5';
      default:
        return 'w-4 h-4';
    }
  };

  return (
    <div {...api().getRootProps()}>
      <button
        {...api().getTriggerProps()}
        class={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors
          ${getSizeClass()} ${getVariantClass()} ${local.class || ''}`}
      >
        <Show when={showIcon()}>
          <Show when={api().copied} fallback={<FiCopy class={iconSize()} />}>
            <FiCheck class={iconSize()} />
          </Show>
        </Show>
        <Show when={showLabel()}>
          <span>{api().copied ? copiedLabel() : label()}</span>
        </Show>
      </button>
    </div>
  );
}

export default Clipboard;
