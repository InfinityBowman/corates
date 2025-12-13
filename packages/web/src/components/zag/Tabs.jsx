import * as tabs from '@zag-js/tabs';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, For, Show } from 'solid-js';

/**
 * Reusable Tabs component using Zag.js
 * @param {Object} props
 * @param {Array<{value: string, label: string, icon?: any}>} props.tabs - Array of tab definitions
 * @param {string} [props.defaultValue] - Default selected tab value
 * @param {string} [props.value] - Controlled tab value (e.g., from URL)
 * @param {(value: string) => void} [props.onValueChange] - Callback when tab changes
 * @param {Object} props.children - Tab content as children (use TabContent component)
 */
export function Tabs(props) {
  const value = () => props.value;
  const defaultValue = () => props.defaultValue;
  const tabsList = () => props.tabs;
  const children = () => props.children;

  const service = useMachine(tabs.machine, {
    id: createUniqueId(),
    get value() {
      return value();
    },
    get defaultValue() {
      return defaultValue() || tabsList()[0]?.value;
    },
    onValueChange(details) {
      props.onValueChange?.(details.value);
    },
  });

  const api = createMemo(() => tabs.connect(service, normalizeProps));

  return (
    <div {...api().getRootProps()}>
      <div
        {...api().getListProps()}
        class='flex border-b border-gray-200 bg-white rounded-t-lg overflow-x-auto'
      >
        <For each={tabsList()}>
          {tab => (
            <button
              {...api().getTriggerProps({ value: tab.value })}
              class='flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-b-2 border-transparent transition-colors whitespace-nowrap data-selected:text-blue-600 data-selected:border-blue-600 data-selected:bg-blue-50/50'
            >
              <Show when={tab.icon}>
                <span class='w-4 h-4'>{tab.icon}</span>
              </Show>
              {tab.label}
              <Show when={tab.count !== undefined || tab.getCount}>
                <span class='ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 data-selected:bg-blue-100 data-selected:text-blue-700'>
                  {tab.getCount ? tab.getCount() : tab.count}
                </span>
              </Show>
            </button>
          )}
        </For>
        <div {...api().getIndicatorProps()} class='hidden' />
      </div>
      <Show when={children()}>
        <For each={tabsList()}>
          {tab => (
            <div
              {...api().getContentProps({ value: tab.value })}
              class='bg-white rounded-b-lg border border-t-0 border-gray-200 p-6'
            >
              {children()?.(tab.value)}
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}

export default Tabs;
