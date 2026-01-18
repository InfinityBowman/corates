/**
 * Collapsible component for expandable content sections.
 *
 * @example
 * <Collapsible>
 *   <CollapsibleTrigger>
 *     <span>Show more</span>
 *     <CollapsibleIndicator>
 *       <FiChevronDown />
 *     </CollapsibleIndicator>
 *   </CollapsibleTrigger>
 *   <CollapsibleContent>
 *     Hidden content that expands when trigger is clicked.
 *   </CollapsibleContent>
 * </Collapsible>
 *
 * @example
 * // Controlled
 * const [open, setOpen] = createSignal(false);
 * <Collapsible open={open()} onOpenChange={setOpen}>
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
  CollapsibleIndicatorProps as ArkCollapsibleIndicatorProps,
} from '@ark-ui/solid/collapsible';
import { cn } from './cn';

type CollapsibleProps = Omit<ArkCollapsibleRootProps, 'onOpenChange'> & {
  class?: string;
  children?: JSX.Element;
  onOpenChange?: (_open: boolean) => void;
};

const Collapsible: Component<CollapsibleProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children', 'onOpenChange']);
  return (
    <CollapsiblePrimitive.Root
      class={local.class}
      onOpenChange={details => local.onOpenChange?.(details.open)}
      {...others}
    >
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
      class={cn('flex items-center text-left', local.class)}
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

type CollapsibleIndicatorProps = ArkCollapsibleIndicatorProps & {
  class?: string;
  children?: JSX.Element;
};

const CollapsibleIndicator: Component<CollapsibleIndicatorProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <CollapsiblePrimitive.Indicator
      class={cn('transition-transform duration-200 data-[state=open]:rotate-180', local.class)}
      {...others}
    >
      {local.children}
    </CollapsiblePrimitive.Indicator>
  );
};

export { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleIndicator };
