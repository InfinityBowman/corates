/**
 * Tabs component using Ark UI
 */

import { Tabs } from '@ark-ui/solid/tabs';
import { Component, For, Show, JSX, createMemo } from 'solid-js';

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
  onValueChange?: (_value: string) => void;
  /** Tab content render function */
  children?: (_tabValue: string) => JSX.Element;
  /** Visual variant (default: 'bordered') */
  variant?: 'bordered' | 'underline';
}

/**
 * Reusable Tabs component
 */
const TabsComponent: Component<TabsProps> = props => {
  const value = () => props.value;
  const defaultValue = () => props.defaultValue;
  const tabsList = () => props.tabs;
  const children = () => props.children;
  const variant = () => props.variant || 'bordered';

  const handleValueChange = (details: { value: string }) => {
    if (props.onValueChange) {
      props.onValueChange(details.value);
    }
  };

  // Conditionally provide value or defaultValue (but not both)
  // When value is provided, use controlled mode
  // Otherwise, use defaultValue for uncontrolled mode
  const rootProps = createMemo(() => {
    const currentValue = value();
    if (currentValue !== undefined && currentValue !== null) {
      return { value: currentValue, onValueChange: handleValueChange };
    }
    return {
      defaultValue: defaultValue() || tabsList()[0]?.value,
      onValueChange: handleValueChange,
    };
  });

  const getListClass = () => {
    if (variant() === 'underline') {
      return 'flex overflow-x-auto border-b rounded-t-lg border-gray-200 bg-white';
    }
    return 'flex overflow-x-auto rounded-t-lg border border-gray-200 bg-white';
  };

  const getContentClass = () => {
    if (variant() === 'underline') {
      return 'bg-white p-6';
    }
    return 'rounded-b-lg border border-t-0 border-gray-200 bg-white p-6';
  };

  return (
    <Tabs.Root {...rootProps()} class='rounded-sm!'>
      <Tabs.List class={getListClass()}>
        <For each={tabsList()}>
          {tab => (
            <Tabs.Trigger
              value={tab.value}
              class='flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-medium whitespace-nowrap text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900'
            >
              <Show when={tab.icon}>
                <span class='h-4 w-4'>{tab.icon}</span>
              </Show>
              {tab.label}
              <Show when={tab.count !== undefined || tab.getCount}>
                <span class='ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600'>
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
            <Tabs.Content value={tab.value} class={getContentClass()}>
              {children()?.(tab.value)}
            </Tabs.Content>
          )}
        </For>
      </Show>
    </Tabs.Root>
  );
};

export { TabsComponent as Tabs };
