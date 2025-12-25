/**
 * Collapsible component using Ark UI
 *
 * Supports both high-level convenience API and low-level composition API
 */

import { Collapsible as ArkCollapsible, useCollapsible } from '@ark-ui/solid/collapsible';
import { Component, Show, splitProps, createMemo, JSX, Accessor } from 'solid-js';

export interface CollapsibleApi {
  open: boolean;
  visible: boolean;
  setOpen: (_open: boolean) => void;
}

export interface CollapsibleProps {
  /** Controlled open state */
  open?: boolean;
  /** Initial open state (uncontrolled) */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_details: { open: boolean }) => void;
  /** Disable the collapsible */
  disabled?: boolean;
  /** Enable lazy mounting */
  lazyMount?: boolean;
  /** Unmount content when closed */
  unmountOnExit?: boolean;
  /** Height when collapsed */
  collapsedHeight?: string | number;
  /** Width when collapsed */
  collapsedWidth?: string | number;
  /** Callback when exit animation completes */
  onExitComplete?: () => void;
  /** Custom IDs for root, content, trigger */
  ids?: { root?: string; content?: string; trigger?: string };
  /** Trigger element or render function receiving collapsible API */
  trigger?: JSX.Element | ((_api: Accessor<CollapsibleApi>) => JSX.Element);
  /** Indicator element or render function receiving collapsible API */
  indicator?: JSX.Element | ((_api: Accessor<CollapsibleApi>) => JSX.Element);
  /** Collapsible content */
  children?: JSX.Element;
}

/**
 * Internal component for when we need programmatic API (function triggers/indicators)
 */
function CollapsibleWithApi(props: {
  arkProps: CollapsibleProps;
  trigger: () => CollapsibleProps['trigger'];
  indicator: () => CollapsibleProps['indicator'];
  children: () => JSX.Element | undefined;
}) {
  const arkProps = () => props.arkProps;
  const collapsibleApi = useCollapsible(arkProps());

  const renderTrigger = () => {
    const triggerValue = props.trigger();
    if (!triggerValue) return null;

    if (typeof triggerValue === 'function') {
      return triggerValue(collapsibleApi);
    }

    return triggerValue;
  };

  const renderIndicator = () => {
    const indicatorValue = props.indicator();
    if (!indicatorValue) return null;

    if (typeof indicatorValue === 'function') {
      return indicatorValue(collapsibleApi);
    }

    return indicatorValue;
  };

  // Handle click events on trigger to prevent toggling when clicking interactive elements
  const handleTriggerClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Check if click is on an interactive element (but not the trigger itself)
    const interactive = target.closest(
      'button:not([data-part="trigger"]), [role="button"]:not([data-part="trigger"]), [role="menuitem"], input, textarea, [data-editable], [data-scope="menu"], [data-scope="editable"], [data-selectable], a',
    );
    if (interactive) {
      e.stopPropagation();
      // Only prevent default for non-input elements to avoid breaking form interactions
      if (!interactive.matches('input, textarea')) {
        e.preventDefault();
      }
    }
  };

  return (
    <ArkCollapsible.RootProvider value={collapsibleApi}>
      <ArkCollapsible.Root {...arkProps()}>
        <Show when={props.trigger()}>
          <ArkCollapsible.Trigger class='w-full' onClick={handleTriggerClick}>
            {renderTrigger() as JSX.Element}
          </ArkCollapsible.Trigger>
        </Show>
        <Show when={props.indicator()}>
          <ArkCollapsible.Indicator class='transition-transform duration-200 data-[state=open]:rotate-90'>
            {renderIndicator() as JSX.Element}
          </ArkCollapsible.Indicator>
        </Show>
        <ArkCollapsible.Content class='overflow-hidden'>{props.children()}</ArkCollapsible.Content>
      </ArkCollapsible.Root>
    </ArkCollapsible.RootProvider>
  );
}

/**
 * High-level Collapsible component (convenience API)
 */
const CollapsibleComponent: Component<CollapsibleProps> = props => {
  // Split convenience props from Ark UI props
  const [local, arkProps] = splitProps(props, ['trigger', 'indicator', 'children']);

  const trigger = () => local.trigger;
  const indicator = () => local.indicator;
  const children = () => local.children;

  // Check if we need the API for function triggers/indicators
  const needsApi = createMemo(() => {
    const triggerValue = trigger();
    const indicatorValue = indicator();
    return typeof triggerValue === 'function' || typeof indicatorValue === 'function';
  });

  // Handle trigger - support both JSX and function (for non-API case)
  const renderTrigger = () => {
    const currentTrigger = trigger();
    if (!currentTrigger) return null;
    return currentTrigger;
  };

  // Handle indicator - support both JSX and function (for non-API case)
  const renderIndicator = () => {
    const currentIndicator = indicator();
    if (!currentIndicator) return null;
    return currentIndicator;
  };

  // Handle click events on trigger to prevent toggling when clicking interactive elements
  const handleTriggerClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Check if click is on an interactive element (but not the trigger itself)
    const interactive = target.closest(
      'button:not([data-part="trigger"]), [role="button"]:not([data-part="trigger"]), [role="menuitem"], input, textarea, [data-editable], [data-scope="menu"], [data-scope="editable"], [data-selectable], a',
    );
    if (interactive) {
      e.stopPropagation();
      // Only prevent default for non-input elements to avoid breaking form interactions
      if (!interactive.matches('input, textarea')) {
        e.preventDefault();
      }
    }
  };

  // Render - use Show to conditionally render with or without API
  return (
    <Show
      when={needsApi()}
      fallback={
        <ArkCollapsible.Root {...arkProps}>
          <Show when={trigger()}>
            <ArkCollapsible.Trigger class='w-full' onClick={handleTriggerClick}>
              {renderTrigger() as JSX.Element}
            </ArkCollapsible.Trigger>
          </Show>
          <Show when={indicator()}>
            <ArkCollapsible.Indicator class='transition-transform duration-200 data-[state=open]:rotate-90'>
              {renderIndicator() as JSX.Element}
            </ArkCollapsible.Indicator>
          </Show>
          <ArkCollapsible.Content class='overflow-hidden'>{children()}</ArkCollapsible.Content>
        </ArkCollapsible.Root>
      }
    >
      <CollapsibleWithApi
        arkProps={arkProps}
        trigger={trigger}
        indicator={indicator}
        children={children}
      />
    </Show>
  );
};

export default CollapsibleComponent;

// Export hook for programmatic control
export { useCollapsible };
