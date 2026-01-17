/**
 * Select component for dropdown selection.
 *
 * @example
 * const items = createListCollection({
 *   items: [
 *     { label: 'React', value: 'react' },
 *     { label: 'Solid', value: 'solid' },
 *     { label: 'Vue', value: 'vue' },
 *   ],
 * });
 *
 * <Select collection={items} onValueChange={details => console.log(details.value)}>
 *   <SelectLabel>Framework</SelectLabel>
 *   <SelectControl>
 *     <SelectTrigger>
 *       <SelectValueText placeholder="Select a framework" />
 *       <SelectIndicator />
 *     </SelectTrigger>
 *   </SelectControl>
 *   <SelectPositioner>
 *     <SelectContent>
 *       <For each={items.items}>
 *         {item => (
 *           <SelectItem item={item}>
 *             <SelectItemText>{item.label}</SelectItemText>
 *             <SelectItemIndicator />
 *           </SelectItem>
 *         )}
 *       </For>
 *     </SelectContent>
 *   </SelectPositioner>
 * </Select>
 *
 * @example
 * // Inside a Dialog (prevents portal z-index issues)
 * <SelectPositioner inDialog>
 *   <SelectContent>...</SelectContent>
 * </SelectPositioner>
 */
import type { Component, JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';
import { Select as SelectPrimitive, createListCollection } from '@ark-ui/solid/select';
import type {
  SelectLabelProps as ArkSelectLabelProps,
  SelectTriggerProps as ArkSelectTriggerProps,
  SelectContentProps as ArkSelectContentProps,
  SelectItemProps as ArkSelectItemProps,
  SelectItemGroupProps as ArkSelectItemGroupProps,
  SelectItemGroupLabelProps as ArkSelectItemGroupLabelProps,
} from '@ark-ui/solid/select';
import { Portal } from 'solid-js/web';
import { BiRegularChevronDown, BiRegularCheck } from 'solid-icons/bi';
import { cn } from './cn';
import { Z_INDEX } from './z-index';

const Select = SelectPrimitive.Root;
const SelectControl = SelectPrimitive.Control;
const SelectValueText = SelectPrimitive.ValueText;
const SelectItemText = SelectPrimitive.ItemText;
const SelectHiddenSelect = SelectPrimitive.HiddenSelect;

type SelectLabelProps = ArkSelectLabelProps & {
  class?: string;
};

const SelectLabel: Component<SelectLabelProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <SelectPrimitive.Label
      class={cn('mb-1.5 block text-sm leading-none font-medium text-gray-900', local.class)}
      {...others}
    />
  );
};

type SelectTriggerProps = ArkSelectTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const SelectTrigger: Component<SelectTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <SelectPrimitive.Trigger
      class={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
        'text-gray-900 ring-offset-white placeholder:text-gray-500',
        'hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[invalid]:border-red-500 data-[invalid]:focus:ring-red-500',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </SelectPrimitive.Trigger>
  );
};

type SelectIndicatorProps = {
  class?: string;
  children?: JSX.Element;
};

const SelectIndicator: Component<SelectIndicatorProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <SelectPrimitive.Indicator
      class={cn('transition-transform duration-200', local.class)}
      {...others}
    >
      <Show
        when={local.children}
        fallback={<BiRegularChevronDown class='h-4 w-4 text-gray-500 opacity-50' />}
      >
        {local.children}
      </Show>
    </SelectPrimitive.Indicator>
  );
};

type SelectClearTriggerProps = {
  class?: string;
  children?: JSX.Element;
};

const SelectClearTrigger: Component<SelectClearTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <SelectPrimitive.ClearTrigger
      class={cn('text-gray-500 hover:text-gray-700', local.class)}
      {...others}
    >
      {local.children}
    </SelectPrimitive.ClearTrigger>
  );
};

type SelectPositionerProps = {
  class?: string;
  children?: JSX.Element;
  inDialog?: boolean;
};

const SelectPositioner: Component<SelectPositionerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children', 'inDialog']);

  const positioner = (
    <SelectPrimitive.Positioner class={local.class} {...others}>
      {local.children}
    </SelectPrimitive.Positioner>
  );

  return (
    <Show when={!local.inDialog} fallback={positioner}>
      <Portal>{positioner}</Portal>
    </Show>
  );
};

type SelectContentProps = ArkSelectContentProps & {
  class?: string;
  children?: JSX.Element;
};

const SelectContent: Component<SelectContentProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <SelectPrimitive.Content
      class={cn(
        'max-h-96 min-w-32 overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-md',
        Z_INDEX.SELECT,
        'focus:outline-none',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </SelectPrimitive.Content>
  );
};

type SelectItemGroupProps = ArkSelectItemGroupProps & {
  class?: string;
};

const SelectItemGroup: Component<SelectItemGroupProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return <SelectPrimitive.ItemGroup class={local.class} {...others} />;
};

type SelectItemGroupLabelProps = ArkSelectItemGroupLabelProps & {
  class?: string;
};

const SelectItemGroupLabel: Component<SelectItemGroupLabelProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <SelectPrimitive.ItemGroupLabel
      class={cn('px-2 py-1.5 text-sm font-semibold text-gray-900', local.class)}
      {...others}
    />
  );
};

type SelectItemProps = ArkSelectItemProps & {
  class?: string;
  children?: JSX.Element;
};

const SelectItem: Component<SelectItemProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <SelectPrimitive.Item
      class={cn(
        'relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 pr-8 text-sm',
        'text-gray-900 outline-none select-none',
        'hover:bg-gray-100 focus:bg-gray-100',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        'data-[highlighted]:bg-gray-100',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </SelectPrimitive.Item>
  );
};

type SelectItemIndicatorProps = {
  class?: string;
  children?: JSX.Element;
};

const SelectItemIndicator: Component<SelectItemIndicatorProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <SelectPrimitive.ItemIndicator
      class={cn('absolute right-2 flex h-3.5 w-3.5 items-center justify-center', local.class)}
      {...others}
    >
      <Show when={local.children} fallback={<BiRegularCheck class='h-4 w-4 text-blue-600' />}>
        {local.children}
      </Show>
    </SelectPrimitive.ItemIndicator>
  );
};

export {
  Select,
  SelectLabel,
  SelectControl,
  SelectTrigger,
  SelectValueText,
  SelectIndicator,
  SelectClearTrigger,
  SelectPositioner,
  SelectContent,
  SelectItemGroup,
  SelectItemGroupLabel,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
  SelectHiddenSelect,
  createListCollection,
};
