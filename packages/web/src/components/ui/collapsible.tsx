/**
 * Collapsible component for expandable content sections.
 *
 * @example
 * <Collapsible>
 *   <CollapsibleTrigger>
 *     <span>Show more</span>
 *     <FiChevronDown />
 *   </CollapsibleTrigger>
 *   <CollapsibleContent>
 *     Hidden content that expands when trigger is clicked.
 *   </CollapsibleContent>
 * </Collapsible>
 *
 * @example
 * // Controlled
 * const [open, setOpen] = createSignal(false);
 * <Collapsible open={open()} onOpenChange={details => setOpen(details.open)}>
 *   <CollapsibleTrigger>Toggle</CollapsibleTrigger>
 *   <CollapsibleContent>Content</CollapsibleContent>
 * </Collapsible>
 *
 * @example
 * // Default open
 * <Collapsible defaultOpen>
 *   ...
 * </Collapsible>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Collapsible as CollapsiblePrimitive } from '@ark-ui/solid/collapsible';
import type {
  CollapsibleRootProps as ArkCollapsibleRootProps,
  CollapsibleTriggerProps as ArkCollapsibleTriggerProps,
  CollapsibleContentProps as ArkCollapsibleContentProps,
} from '@ark-ui/solid/collapsible';
import { cn } from './cn';

type CollapsibleProps = ArkCollapsibleRootProps & {
  class?: string;
  children?: JSX.Element;
};

const Collapsible: Component<CollapsibleProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <CollapsiblePrimitive.Root class={local.class} {...others}>
      {local.children}
    </CollapsiblePrimitive.Root>
  );
};

type CollapsibleTriggerProps = ArkCollapsibleTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const CollapsibleTrigger: Component<CollapsibleTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <CollapsiblePrimitive.Trigger
      class={cn('flex w-full items-center justify-between text-left', local.class)}
      {...others}
    >
      {local.children}
    </CollapsiblePrimitive.Trigger>
  );
};

type CollapsibleContentProps = ArkCollapsibleContentProps & {
  class?: string;
  children?: JSX.Element;
  horizontal?: boolean;
};

const CollapsibleContent: Component<CollapsibleContentProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children', 'horizontal']);
  return (
    <CollapsiblePrimitive.Content
      class={cn('overflow-hidden', local.horizontal && 'collapsible-horizontal', local.class)}
      {...others}
    >
      {local.children}
    </CollapsiblePrimitive.Content>
  );
};

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
