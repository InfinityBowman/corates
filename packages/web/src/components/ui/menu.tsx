/**
 * Menu component for dropdown actions.
 *
 * @example
 * <Menu>
 *   <MenuTrigger>
 *     <Button variant="ghost" size="icon"><FiMoreVertical /></Button>
 *   </MenuTrigger>
 *   <MenuPositioner>
 *     <MenuContent>
 *       <MenuItem value="edit">Edit</MenuItem>
 *       <MenuItem value="duplicate">Duplicate</MenuItem>
 *       <MenuSeparator />
 *       <MenuItem value="delete" destructive>Delete</MenuItem>
 *     </MenuContent>
 *   </MenuPositioner>
 * </Menu>
 *
 * @example
 * // With groups
 * <MenuContent>
 *   <MenuItemGroup>
 *     <MenuItemGroupLabel>Actions</MenuItemGroupLabel>
 *     <MenuItem value="edit">Edit</MenuItem>
 *   </MenuItemGroup>
 * </MenuContent>
 *
 * @example
 * // Context menu
 * <Menu>
 *   <MenuContextTrigger>
 *     <div>Right-click me</div>
 *   </MenuContextTrigger>
 *   <MenuPositioner>
 *     <MenuContent>...</MenuContent>
 *   </MenuPositioner>
 * </Menu>
 *
 * @example
 * // Inside a Dialog (prevents portal z-index issues)
 * <MenuPositioner inDialog>
 *   <MenuContent>...</MenuContent>
 * </MenuPositioner>
 */
import type { Component, JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';
import { Menu as MenuPrimitive } from '@ark-ui/solid/menu';
import type {
  MenuContentProps as ArkMenuContentProps,
  MenuTriggerProps as ArkMenuTriggerProps,
  MenuItemProps as ArkMenuItemProps,
  MenuItemGroupProps as ArkMenuItemGroupProps,
  MenuItemGroupLabelProps as ArkMenuItemGroupLabelProps,
  MenuSeparatorProps as ArkMenuSeparatorProps,
} from '@ark-ui/solid/menu';
import { Portal } from 'solid-js/web';
import { cn } from './cn';
import { Z_INDEX } from './z-index';

const Menu = MenuPrimitive.Root;
const MenuContextTrigger = MenuPrimitive.ContextTrigger;

type MenuTriggerProps = ArkMenuTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const MenuTrigger: Component<MenuTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <MenuPrimitive.Trigger class={local.class} {...others}>
      {local.children}
    </MenuPrimitive.Trigger>
  );
};

type MenuPositionerProps = {
  class?: string;
  children?: JSX.Element;
  inDialog?: boolean;
};

const MenuPositioner: Component<MenuPositionerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children', 'inDialog']);

  const positioner = (
    <MenuPrimitive.Positioner class={local.class} {...others}>
      {local.children}
    </MenuPrimitive.Positioner>
  );

  return (
    <Show when={!local.inDialog} fallback={positioner}>
      <Portal>{positioner}</Portal>
    </Show>
  );
};

type MenuContentProps = ArkMenuContentProps & {
  class?: string;
  children?: JSX.Element;
};

const MenuContent: Component<MenuContentProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <MenuPrimitive.Content
      class={cn(
        'min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-md outline-none',
        Z_INDEX.MENU,
        local.class,
      )}
      {...others}
    >
      {local.children}
    </MenuPrimitive.Content>
  );
};

type MenuItemProps = ArkMenuItemProps & {
  class?: string;
  children?: JSX.Element;
  destructive?: boolean;
};

const MenuItem: Component<MenuItemProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children', 'destructive']);
  return (
    <MenuPrimitive.Item
      class={cn(
        'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none',
        'data-[highlighted]:bg-gray-100',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        local.destructive
          ? 'text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700'
          : 'text-gray-900',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </MenuPrimitive.Item>
  );
};

type MenuItemGroupProps = ArkMenuItemGroupProps & {
  class?: string;
};

const MenuItemGroup: Component<MenuItemGroupProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return <MenuPrimitive.ItemGroup class={local.class} {...others} />;
};

type MenuItemGroupLabelProps = ArkMenuItemGroupLabelProps & {
  class?: string;
};

const MenuItemGroupLabel: Component<MenuItemGroupLabelProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <MenuPrimitive.ItemGroupLabel
      class={cn('px-2 py-1.5 text-xs font-semibold text-gray-500', local.class)}
      {...others}
    />
  );
};

type MenuSeparatorProps = ArkMenuSeparatorProps & {
  class?: string;
};

const MenuSeparator: Component<MenuSeparatorProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <MenuPrimitive.Separator
      class={cn('-mx-1 my-1 h-px bg-gray-200', local.class)}
      {...others}
    />
  );
};

export {
  Menu,
  MenuTrigger,
  MenuContextTrigger,
  MenuPositioner,
  MenuContent,
  MenuItem,
  MenuItemGroup,
  MenuItemGroupLabel,
  MenuSeparator,
};
