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
  const service = useMachine(collapsible.machine, () => ({
    id: createUniqueId(),
    get open() {
      return props.open;
    },
    defaultOpen: props.defaultOpen,
    get disabled() {
      return props.disabled;
    },
    onOpenChange(details) {
      props.onOpenChange?.(details.open);
    },
  }));

  const api = createMemo(() => collapsible.connect(service, normalizeProps));

  return (
    <div {...api().getRootProps()}>
      {props.trigger?.(api())}
      <div {...api().getContentProps()} class='collapsible-content overflow-hidden'>
        {props.children}
      </div>
      <style>{`
        .collapsible-content[data-state="open"] {
          animation: collapsible-slideDown 150ms ease-out;
        }
        .collapsible-content[data-state="closed"] {
          animation: collapsible-slideUp 150ms ease-out;
        }
        @keyframes collapsible-slideDown {
          from {
            height: 0;
          }
          to {
            height: var(--height);
          }
        }
        @keyframes collapsible-slideUp {
          from {
            height: var(--height);
          }
          to {
            height: 0;
          }
        }
      `}</style>
    </div>
  );
}
