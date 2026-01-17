/**
 * Tabs component for tabbed interfaces.
 *
 * @example
 * <Tabs defaultValue="account">
 *   <TabsList>
 *     <TabsTrigger value="account">Account</TabsTrigger>
 *     <TabsTrigger value="password">Password</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="account">
 *     Account settings here
 *   </TabsContent>
 *   <TabsContent value="password">
 *     Password settings here
 *   </TabsContent>
 * </Tabs>
 *
 * @example
 * // Controlled tabs
 * const [tab, setTab] = createSignal('account');
 * <Tabs value={tab()} onValueChange={setTab}>
 *   ...
 * </Tabs>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Tabs as TabsPrimitive } from '@ark-ui/solid/tabs';
import type {
  TabsRootProps as ArkTabsRootProps,
  TabListProps as ArkTabsListProps,
  TabTriggerProps as ArkTabsTriggerProps,
  TabContentProps as ArkTabsContentProps,
  TabIndicatorProps as ArkTabsIndicatorProps,
} from '@ark-ui/solid/tabs';
import { cn } from './cn';

type TabsProps = Omit<ArkTabsRootProps, 'onValueChange'> & {
  class?: string;
  children?: JSX.Element;
  onValueChange?: (_value: string) => void;
};

const Tabs: Component<TabsProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children', 'onValueChange']);
  return (
    <TabsPrimitive.Root
      class={local.class}
      onValueChange={details => local.onValueChange?.(details.value)}
      {...others}
    >
      {local.children}
    </TabsPrimitive.Root>
  );
};

type TabsListProps = ArkTabsListProps & {
  class?: string;
  children?: JSX.Element;
};

const TabsList: Component<TabsListProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <TabsPrimitive.List
      class={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </TabsPrimitive.List>
  );
};

type TabsTriggerProps = ArkTabsTriggerProps & {
  class?: string;
  children?: JSX.Element;
};

const TabsTrigger: Component<TabsTriggerProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <TabsPrimitive.Trigger
      class={cn(
        'inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap',
        'ring-offset-white transition-all',
        'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[selected]:bg-white data-[selected]:text-gray-900 data-[selected]:shadow-sm',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </TabsPrimitive.Trigger>
  );
};

type TabsContentProps = ArkTabsContentProps & {
  class?: string;
  children?: JSX.Element;
};

const TabsContent: Component<TabsContentProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <TabsPrimitive.Content
      class={cn(
        'mt-2 ring-offset-white',
        'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </TabsPrimitive.Content>
  );
};

type TabsIndicatorProps = ArkTabsIndicatorProps & {
  class?: string;
};

const TabsIndicator: Component<TabsIndicatorProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <TabsPrimitive.Indicator
      class={cn('absolute bottom-0 h-0.5 bg-blue-600 transition-all', local.class)}
      {...others}
    />
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsIndicator };
