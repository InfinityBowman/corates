/**
 * Tabs component using Ark UI
 */

import { Tabs } from '@ark-ui/solid/tabs';
import { Component, For, Show, JSX } from 'solid-js';

export interface TabDefinition {
  value: string;
  label: string;
  icon?: JSX.Element;
  count?: number;
  getCount?: () => number;
}

export interface TabsProps {
  /** Array of tab definitions */
  tabs: TabDefinition[];
  /** Default selected tab value */
  defaultValue?: string;
  /** Controlled tab value */
  value?: string;
  /** Callback when tab changes */
  onValueChange?: (value: string) => void;
  /** Tab content render function */
  children?: (tabValue: string) => JSX.Element;
}

/**
 * Reusable Tabs component
 */
const TabsComponent: Component<TabsProps> = props => {
  const value = () => props.value;
  const defaultValue = () => props.defaultValue;
  const tabsList = () => props.tabs;
  const children = () => props.children;

  const handleValueChange = (details: { value: string }) => {
    if (props.onValueChange) {
      props.onValueChange(details.value);
    }
  };

  return (
    <Tabs.Root
      value={value()}
      defaultValue={defaultValue() || tabsList()[0]?.value}
      onValueChange={handleValueChange}
    >
      <Tabs.List class='flex overflow-x-auto rounded-t-lg border-b border-gray-200 bg-white'>
        <For each={tabsList()}>
          {tab => (
            <Tabs.Trigger
              value={tab.value}
              class='flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-medium whitespace-nowrap text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 data-[selected]:border-blue-600 data-[selected]:bg-blue-50/50 data-[selected]:text-blue-600'
            >
              <Show when={tab.icon}>
                <span class='h-4 w-4'>{tab.icon}</span>
              </Show>
              {tab.label}
              <Show when={tab.count !== undefined || tab.getCount}>
                <span class='ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 data-[selected]:bg-blue-100 data-[selected]:text-blue-700'>
                  {tab.getCount ? tab.getCount() : tab.count}
                </span>
              </Show>
            </Tabs.Trigger>
          )}
        </For>
        <Tabs.Indicator class='hidden' />
      </Tabs.List>
      <Show when={children()}>
        <For each={tabsList()}>
          {tab => (
            <Tabs.Content
              value={tab.value}
              class='rounded-b-lg border border-t-0 border-gray-200 bg-white p-6'
            >
              {children()?.(tab.value)}
            </Tabs.Content>
          )}
        </For>
      </Show>
    </Tabs.Root>
  );
};

export { TabsComponent as Tabs };
