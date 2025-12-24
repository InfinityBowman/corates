/**
 * Clipboard components using Ark UI
 */

import { Clipboard } from '@ark-ui/solid/clipboard';
import { Component, Show, splitProps, createSignal, createMemo, Accessor, JSX } from 'solid-js';
import { FiCopy, FiCheck } from 'solid-icons/fi';

export interface ClipboardApi {
  /** Current value */
  value: string;
  /** Whether content was copied */
  copied: boolean;
  /** Copy to clipboard */
  copy: () => void;
  /** Get root props */
  getRootProps: () => JSX.HTMLAttributes<HTMLDivElement>;
  /** Get label props */
  getLabelProps: () => JSX.HTMLAttributes<HTMLLabelElement>;
  /** Get control props */
  getControlProps: () => JSX.HTMLAttributes<HTMLDivElement>;
  /** Get input props */
  getInputProps: () => JSX.HTMLAttributes<HTMLInputElement>;
  /** Get trigger props */
  getTriggerProps: () => JSX.HTMLAttributes<HTMLButtonElement>;
}

export interface ClipboardProps {
  /** Value to copy to clipboard */
  value?: string;
  /** Initial value to copy */
  defaultValue?: string;
  /** Callback when value changes */
  onValueChange?: (details: { value: string }) => void;
  /** Callback when copy status changes */
  onStatusChange?: (details: { copied: boolean }) => void;
  /** Time in ms before resetting copied state (default: 3000) */
  timeout?: number;
  /** Label for the input */
  label?: string;
  /** Show input field (default: true) */
  showInput?: boolean;
  /** Render function for custom UI */
  children?: (api: Accessor<ClipboardApi>) => JSX.Element;
  /** Additional class for root element */
  class?: string;
}

/**
 * Clipboard - Copy to clipboard functionality
 */
const ClipboardComponent: Component<ClipboardProps> = (props) => {
  const [local, machineProps] = splitProps(props, ['label', 'showInput', 'children', 'class']);
  const [copied, setCopied] = createSignal(false);

  const handleStatusChange = (details: { copied: boolean }) => {
    setCopied(details.copied);
    if (machineProps.onStatusChange) {
      machineProps.onStatusChange({ copied: details.copied });
    }
  };

  const handleValueChange = (details: { value: string }) => {
    if (machineProps.onValueChange) {
      machineProps.onValueChange(details);
    }
  };

  // Create API object for render prop compatibility
  const api = createMemo(() => ({
    get copied() {
      return copied();
    },
    copy: () => {
      // Trigger copy via the Clipboard.Trigger
    },
    value: machineProps.value || machineProps.defaultValue || '',
    getRootProps: () => ({}),
    getLabelProps: () => ({}),
    getControlProps: () => ({}),
    getInputProps: () => ({}),
    getTriggerProps: () => ({}),
  }));

  const showInput = () => local.showInput !== false;

  return (
    <Show when={!local.children} fallback={local.children?.(api)}>
      <Clipboard.Root
        value={machineProps.value}
        defaultValue={machineProps.defaultValue}
        onValueChange={handleValueChange}
        onStatusChange={handleStatusChange}
        timeout={machineProps.timeout ?? 3000}
        class={`w-full ${local.class || ''}`}
      >
        <Show when={local.label}>
          <Clipboard.Label class='mb-1 block text-sm font-medium text-gray-700'>
            {local.label}
          </Clipboard.Label>
        </Show>
        <Clipboard.Control class='flex items-center gap-2'>
          <Show when={showInput()}>
            <Clipboard.Input class='flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none' />
          </Show>
          <Clipboard.Trigger
            class={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              copied() ?
                'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Clipboard.Indicator copied={<FiCheck class='h-4 w-4' />}>
              <FiCopy class='h-4 w-4' />
            </Clipboard.Indicator>
            <span>{copied() ? 'Copied!' : 'Copy'}</span>
          </Clipboard.Trigger>
        </Clipboard.Control>
      </Clipboard.Root>
    </Show>
  );
};

export interface CopyButtonProps {
  /** Value to copy */
  value: string;
  /** Callback when copy status changes */
  onStatusChange?: (details: { copied: boolean }) => void;
  /** Time in ms before resetting (default: 3000) */
  timeout?: number;
  /** Button label (default: 'Copy') */
  label?: string;
  /** Label when copied (default: 'Copied!') */
  copiedLabel?: string;
  /** Button size (default: 'md') */
  size?: 'sm' | 'md' | 'lg';
  /** Button variant (default: 'solid') */
  variant?: 'solid' | 'outline' | 'ghost';
  /** Show copy/check icon (default: true) */
  showIcon?: boolean;
  /** Show text label (default: true) */
  showLabel?: boolean;
  /** Additional class for button */
  class?: string;
}

/**
 * CopyButton - Simple copy button without input field
 */
export const CopyButton: Component<CopyButtonProps> = (props) => {
  const [local, machineProps] = splitProps(props, [
    'label',
    'copiedLabel',
    'size',
    'variant',
    'showIcon',
    'showLabel',
    'class',
  ]);
  const [copied, setCopied] = createSignal(false);

  const handleStatusChange = (details: { copied: boolean }) => {
    setCopied(details.copied);
    if (machineProps.onStatusChange) {
      machineProps.onStatusChange({ copied: details.copied });
    }
  };

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
    switch (local.variant) {
      case 'outline':
        return copied() ?
            'border border-green-500 text-green-700 hover:bg-green-50'
          : 'border border-gray-300 text-gray-700 hover:bg-gray-50';
      case 'ghost':
        return copied() ? 'text-green-700 hover:bg-green-100' : 'text-gray-700 hover:bg-gray-100';
      default:
        return copied() ?
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
    <Clipboard.Root
      value={machineProps.value}
      defaultValue={machineProps.defaultValue}
      onStatusChange={handleStatusChange}
      timeout={machineProps.timeout ?? 3000}
    >
      <Clipboard.Trigger
        class={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors ${getSizeClass()} ${getVariantClass()} ${local.class || ''}`}
      >
        <Show when={showIcon()}>
          <Clipboard.Indicator copied={<FiCheck class={iconSize()} />}>
            <FiCopy class={iconSize()} />
          </Clipboard.Indicator>
        </Show>
        <Show when={showLabel()}>
          <span>{copied() ? copiedLabel() : label()}</span>
        </Show>
      </Clipboard.Trigger>
    </Clipboard.Root>
  );
};

export { ClipboardComponent as Clipboard };
