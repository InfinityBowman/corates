import * as collapsible from '@zag-js/collapsible';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId } from 'solid-js';

/**
 * Zag.js Collapsible component
 * @param {Object} props
 * @param {boolean} props.open - Controlled open state
 * @param {boolean} props.defaultOpen - Default open state (uncontrolled)
 * @param {Function} props.onOpenChange - Callback when open state changes
 * @param {boolean} props.disabled - Whether the collapsible is disabled
 * @param {JSX.Element} props.trigger - The trigger element (receives api)
 * @param {JSX.Element} props.children - The content to show/hide
 */
export default function Collapsible(props) {
  const open = () => props.open;
  const defaultOpen = () => props.defaultOpen;
  const disabled = () => props.disabled;
  const trigger = () => props.trigger;
  const children = () => props.children;

  const service = useMachine(collapsible.machine, () => ({
    id: createUniqueId(),
    open: open(),
    defaultOpen: defaultOpen(),
    disabled: disabled(),
    onOpenChange(details) {
      props.onOpenChange?.(details.open);
    },
  }));

  const api = createMemo(() => collapsible.connect(service, normalizeProps));

  return (
    <div {...api().getRootProps()}>
      {trigger()?.(api())}
      <div {...api().getContentProps()}>{children()}</div>
    </div>
  );
}
