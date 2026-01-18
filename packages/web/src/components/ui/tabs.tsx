/**
 * Tabs component for tabbed interfaces.
 * Uses minimal default styles - add your own via class props.
 *
 * @example
 * // Bordered tabs (common pattern)
 * <Tabs defaultValue="account">
 *   <TabsList class="overflow-x-auto rounded-t-lg border border-gray-200 bg-white">
 *     <TabsTrigger
 *       value="account"
 *       class="border-b-2 border-transparent text-gray-600 hover:bg-gray-50 data-[selected]:border-blue-600 data-[selected]:text-gray-900"
 *     >
 *       Account
 *     </TabsTrigger>
 *     <TabsTrigger value="password" class="...">Password</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="account" class="rounded-b-lg border border-t-0 border-gray-200 bg-white p-6">
 *     Account settings here
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
      class={cn('flex items-center', local.class)}
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
        'inline-flex items-center px-4 py-3 text-sm font-medium whitespace-nowrap',
        'transition-colors',
        'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
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
