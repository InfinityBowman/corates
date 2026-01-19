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
import { Index, Show, splitProps, createMemo } from 'solid-js';
import { Select as SelectPrimitive, createListCollection } from '@ark-ui/solid/select';
import type {
  SelectRootProps as ArkSelectRootProps,
  SelectLabelProps as ArkSelectLabelProps,
  SelectTriggerProps as ArkSelectTriggerProps,
  SelectContentProps as ArkSelectContentProps,
  SelectItemProps as ArkSelectItemProps,
  SelectItemGroupProps as ArkSelectItemGroupProps,
  SelectItemGroupLabelProps as ArkSelectItemGroupLabelProps,
  SelectPositionerProps as ArkSelectPositionerProps,
} from '@ark-ui/solid/select';
import { Portal } from 'solid-js/web';
import { BiRegularChevronDown, BiRegularCheck } from 'solid-icons/bi';
import { cn } from './cn';
import { Z_INDEX } from './z-index';

type SelectProps<T> = Omit<ArkSelectRootProps<T>, 'onValueChange' | 'onOpenChange'> & {
  children?: JSX.Element;
  onValueChange?: (_value: string[]) => void;
  onOpenChange?: (_open: boolean) => void;
};

const Select = <T,>(props: SelectProps<T>) => {
  const [local, others] = splitProps(props, ['children', 'onValueChange', 'onOpenChange']);
  return (
    <SelectPrimitive.Root
      positioning={{ sameWidth: true, ...props.positioning }}
      onValueChange={details => local.onValueChange?.(details.value)}
      onOpenChange={details => local.onOpenChange?.(details.open)}
      {...others}
    >
      {local.children}
    </SelectPrimitive.Root>
  );
};

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
      class={cn('text-foreground mb-1.5 block text-sm leading-none font-medium', local.class)}
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
        'border-border bg-card flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
        'text-foreground ring-offset-background placeholder:text-muted-foreground',
        'hover:bg-muted focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-invalid:border-destructive data-invalid:focus:ring-destructive',
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
        fallback={<BiRegularChevronDown class='text-muted-foreground h-4 w-4 opacity-50' />}
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
      class={cn('text-muted-foreground hover:text-foreground', local.class)}
      {...others}
    >
      {local.children}
    </SelectPrimitive.ClearTrigger>
  );
};

type SelectPositionerProps = ArkSelectPositionerProps & {
  class?: string;
  children?: JSX.Element;
  /** Set to true when used inside a Dialog to prevent z-index issues */
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
        'border-border bg-popover max-h-96 min-w-32 overflow-hidden rounded-md border p-1 shadow-md',
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
      class={cn('text-foreground px-2 py-1.5 text-sm font-semibold', local.class)}
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
        'text-popover-foreground outline-none select-none',
        'hover:bg-muted focus:bg-muted',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        'data-highlighted:bg-muted',
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
      <Show when={local.children} fallback={<BiRegularCheck class='text-primary h-4 w-4' />}>
        {local.children}
      </Show>
    </SelectPrimitive.ItemIndicator>
  );
};

// --- SimpleSelect: Convenience wrapper matching old @corates/ui API ---

type SelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type SimpleSelectProps = {
  /** Options to display */
  items: SelectOption[];
  /** The selected value (controlled) */
  value?: string;
  /** Callback when value changes */
  onChange?: (_value: string) => void;
  /** Label text for the select */
  label?: string;
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Array of values that should be disabled */
  disabledValues?: string[];
  /** Set to true when used inside a Dialog */
  inDialog?: boolean;
  /** Additional class for the root element */
  class?: string;
};

const SimpleSelect: Component<SimpleSelectProps> = props => {
  const [local, others] = splitProps(props, [
    'items',
    'value',
    'onChange',
    'label',
    'placeholder',
    'disabledValues',
    'inDialog',
    'class',
  ]);

  const disabledSet = () => new Set(local.disabledValues || []);

  // Use createMemo for reactive collection updates (Ark UI best practice)
  const collection = createMemo(() =>
    createListCollection({
      items: (local.items || []).map(item => ({
        ...item,
        disabled: item.disabled || disabledSet().has(item.value),
      })),
      itemToString: item => item.label,
      itemToValue: item => item.value,
    }),
  );

  // Convert single value to array format for Ark UI
  const selectValue = () => (local.value != null && local.value !== '' ? [local.value] : []);

  return (
    <Select
      collection={collection()}
      value={selectValue()}
      onValueChange={values => local.onChange?.(values[0] || '')}
      class={local.class}
      {...others}
    >
      <Show when={local.label}>
        <SelectLabel>{local.label}</SelectLabel>
      </Show>
      <SelectControl>
        <SelectTrigger>
          <SelectValueText placeholder={local.placeholder || 'Select option'} />
          <SelectIndicator />
        </SelectTrigger>
      </SelectControl>
      <SelectPositioner inDialog={local.inDialog}>
        <SelectContent>
          <Index each={collection().items}>
            {item => (
              <SelectItem item={item()}>
                <SelectItemText>{item().label}</SelectItemText>
                <SelectItemIndicator />
              </SelectItem>
            )}
          </Index>
        </SelectContent>
      </SelectPositioner>
      <SelectHiddenSelect />
    </Select>
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
  SimpleSelect,
};
