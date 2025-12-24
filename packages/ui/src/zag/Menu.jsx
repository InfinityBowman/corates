/**
 * Menu - Dropdown menu for actions using Ark UI
 */

import { Menu } from '@ark-ui/solid/menu';
import { Portal } from 'solid-js/web';
import { createSignal, Show, For, splitProps } from 'solid-js';
import { Z_INDEX } from '../constants/zIndex.js';

/**
 * Menu - Dropdown menu for actions
 *
 * Props:
 * - trigger: JSX.Element - The trigger element
 * - items: Array<MenuItem> - Menu items
 * - onSelect: (details: { value: string }) => void - Callback when item is selected
 * - open: boolean - Controlled open state
 * - defaultOpen: boolean - Initial open state
 * - onOpenChange: (details: { open: boolean }) => void - Callback when open state changes
 * - placement: Placement - Menu placement (default: 'bottom-start')
 * - closeOnSelect: boolean - Close menu on selection (default: true)
 * - inDialog: boolean - Set to true when used inside a Dialog
 * - hideIndicator: boolean - Hide the dropdown indicator chevron
 * - class: string - Additional class for content
 *
 * MenuItem:
 * - value: string - Unique value for the item
 * - label: string - Display label
 * - icon?: JSX.Element - Optional icon
 * - disabled?: boolean - Whether item is disabled
 * - destructive?: boolean - Style as destructive action
 * - separator?: boolean - Render as separator instead of item
 * - groupLabel?: string - Render as group label
 */
export function MenuComponent(props) {
  const [local, machineProps] = splitProps(props, [
    'trigger',
    'items',
    'inDialog',
    'hideIndicator',
    'placement',
    'class',
  ]);

  const handleSelect = (details) => {
    if (machineProps.onSelect) {
      machineProps.onSelect(details);
    }
  };

  // Track open state for conditional rendering
  const [isOpen, setIsOpen] = createSignal(false);

  const handleOpenChange = (details) => {
    setIsOpen(details.open);
    if (machineProps.onOpenChange) {
      machineProps.onOpenChange(details);
    }
  };

  const renderContent = () => (
    <Menu.Positioner>
      <Menu.Content
        class={`${Z_INDEX.MENU} min-w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none ${local.class || ''}`}
      >
        <For each={local.items}>
          {(item) => (
            <Show
              when={!item.separator && !item.groupLabel}
              fallback={
                <Show
                  when={item.separator}
                  fallback={
                    <Menu.ItemGroupLabel class='px-3 py-1.5 text-xs font-medium tracking-wide text-gray-500 uppercase'>
                      {item.groupLabel}
                    </Menu.ItemGroupLabel>
                  }
                >
                  <Menu.Separator class='my-1 border-t border-gray-100' />
                </Show>
              }
            >
              <Menu.Item
                value={item.value}
                disabled={item.disabled}
                closeOnSelect={machineProps.closeOnSelect ?? true}
                onSelect={handleSelect}
                class={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  item.destructive ?
                    'text-red-600 hover:bg-red-50 data-[highlighted]:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-50 data-[highlighted]:bg-gray-50'
                } ${item.disabled ? 'cursor-not-allowed opacity-50' : ''} focus:outline-none`}
              >
                <Show when={item.icon}>
                  <span class='h-4 w-4 shrink-0'>{item.icon}</span>
                </Show>
                <Menu.ItemText>{item.label}</Menu.ItemText>
              </Menu.Item>
            </Show>
          )}
        </For>
      </Menu.Content>
    </Menu.Positioner>
  );

  return (
    <Menu.Root
      open={machineProps.open}
      defaultOpen={machineProps.defaultOpen}
      onOpenChange={handleOpenChange}
      closeOnSelect={machineProps.closeOnSelect ?? true}
      positioning={{ placement: local.placement || 'bottom-start' }}
    >
      <Menu.Trigger class='inline-flex items-center gap-1 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'>
        {local.trigger}
        <Show when={!local.hideIndicator}>
          <Menu.Indicator class='transition-transform data-[state=open]:rotate-180'>
            <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='2'
                d='M19 9l-7 7-7-7'
              />
            </svg>
          </Menu.Indicator>
        </Show>
      </Menu.Trigger>
      <Show when={isOpen()}>
        <Show when={!local.inDialog} fallback={renderContent()}>
          <Portal>{renderContent()}</Portal>
        </Show>
      </Show>
    </Menu.Root>
  );
}

export { MenuComponent as Menu };
export default MenuComponent;
