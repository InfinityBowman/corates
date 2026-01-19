/**
 * Popover component for floating content panels.
 *
 * @example
 * <Popover>
 *   <PopoverTrigger>
 *     <Button>Open Popover</Button>
 *   </PopoverTrigger>
 *   <PopoverPositioner>
 *     <PopoverContent>
 *       <PopoverTitle>Settings</PopoverTitle>
 *       <PopoverDescription>Adjust your preferences below.</PopoverDescription>
 *       <PopoverCloseTrigger>
 *         <FiX />
 *       </PopoverCloseTrigger>
 *     </PopoverContent>
 *   </PopoverPositioner>
 * </Popover>
 *
 * @example
 * // Inside a Dialog (prevents portal z-index issues)
 * <PopoverPositioner inDialog>
 *   <PopoverContent>...</PopoverContent>
 * </PopoverPositioner>
 *
 * @example
 * // With arrow
 * <PopoverContent>
 *   <PopoverArrow>
 *     <PopoverArrowTip />
 *   </PopoverArrow>
 *   Content here
 * </PopoverContent>
 */
import type { Component, JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';
import { Popover as PopoverPrimitive } from '@ark-ui/solid/popover';
import type {
  PopoverRootProps as ArkPopoverRootProps,
  PopoverContentProps as ArkPopoverContentProps,
  PopoverTriggerProps as ArkPopoverTriggerProps,
  PopoverTitleProps as ArkPopoverTitleProps,
  PopoverDescriptionProps as ArkPopoverDescriptionProps,
  PopoverCloseTriggerProps as ArkPopoverCloseTriggerProps,
  PopoverArrowProps as ArkPopoverArrowProps,
  PopoverArrowTipProps as ArkPopoverArrowTipProps,
} from '@ark-ui/solid/popover';
import { Portal } from 'solid-js/web';
import { cn } from './cn';
import { Z_INDEX } from './z-index';

type PopoverProps = Omit<ArkPopoverRootProps, 'onOpenChange'> & {
  children?: JSX.Element;
  onOpenChange?: (_open: boolean) => void;
};

const Popover: Component<PopoverProps> = props => {
  const [local, others] = splitProps(props, ['children', 'onOpenChange']);
  return (
    <PopoverPrimitive.Root onOpenChange={details => local.onOpenChange?.(details.open)} {...others}>
      {local.children}
    </PopoverPrimitive.Root>
  );
};

const PopoverAnchor = PopoverPrimitive.Anchor;

type PopoverTriggerProps = ArkPopoverTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const PopoverTrigger: Component<PopoverTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <PopoverPrimitive.Trigger class={local.class} {...others}>
      {local.children}
    </PopoverPrimitive.Trigger>
  );
};

type PopoverPositionerProps = {
  class?: string;
  children?: JSX.Element;
  inDialog?: boolean;
};

const PopoverPositioner: Component<PopoverPositionerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children', 'inDialog']);

  const positioner = (
    <PopoverPrimitive.Positioner class={local.class} {...others}>
      {local.children}
    </PopoverPrimitive.Positioner>
  );

  return (
    <Show when={!local.inDialog} fallback={positioner}>
      <Portal>{positioner}</Portal>
    </Show>
  );
};

type PopoverContentProps = ArkPopoverContentProps & {
  class?: string;
  children?: JSX.Element;
};

const PopoverContent: Component<PopoverContentProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <PopoverPrimitive.Content
      class={cn(
        'border-border bg-popover w-72 rounded-md border p-4 shadow-md outline-none',
        Z_INDEX.POPOVER,
        local.class,
      )}
      {...others}
    >
      {local.children}
    </PopoverPrimitive.Content>
  );
};

type PopoverTitleProps = ArkPopoverTitleProps & {
  class?: string;
};

const PopoverTitle: Component<PopoverTitleProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <PopoverPrimitive.Title
      class={cn('text-popover-foreground text-sm font-medium', local.class)}
      {...others}
    />
  );
};

type PopoverDescriptionProps = ArkPopoverDescriptionProps & {
  class?: string;
};

const PopoverDescription: Component<PopoverDescriptionProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <PopoverPrimitive.Description
      class={cn('text-muted-foreground mt-1 text-sm', local.class)}
      {...others}
    />
  );
};

type PopoverCloseTriggerProps = ArkPopoverCloseTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const PopoverCloseTrigger: Component<PopoverCloseTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <PopoverPrimitive.CloseTrigger
      class={cn(
        'text-muted-foreground hover:bg-muted hover:text-foreground absolute top-2 right-2 rounded-md p-1',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </PopoverPrimitive.CloseTrigger>
  );
};

type PopoverArrowProps = ArkPopoverArrowProps & {
  class?: string;
};

const PopoverArrow: Component<PopoverArrowProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return <PopoverPrimitive.Arrow class={local.class} {...others} />;
};

type PopoverArrowTipProps = ArkPopoverArrowTipProps & {
  class?: string;
};

const PopoverArrowTip: Component<PopoverArrowTipProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <PopoverPrimitive.ArrowTip
      class={cn('border-border bg-popover border-t border-l', local.class)}
      {...others}
    />
  );
};

export {
  Popover,
  PopoverAnchor,
  PopoverTrigger,
  PopoverPositioner,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
  PopoverCloseTrigger,
  PopoverArrow,
  PopoverArrowTip,
};
