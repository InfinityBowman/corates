import * as tooltip from '@zag-js/tooltip';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, Show } from 'solid-js';

export function Tooltip(props) {
  const placement = () => props.placement;
  const openDelay = () => props.openDelay;
  const closeDelay = () => props.closeDelay;
  const children = () => props.children;
  const content = () => props.content;

  const service = useMachine(tooltip.machine, () => ({
    id: createUniqueId(),
    positioning: {
      placement: placement() || 'top',
    },
    openDelay: openDelay() ?? 100,
    closeDelay: closeDelay() ?? 0,
  }));

  const api = createMemo(() => tooltip.connect(service, normalizeProps));

  return (
    <>
      <span {...api().getTriggerProps()}>{children()}</span>
      <Show when={api().open}>
        <div {...api().getPositionerProps()}>
          <div {...api().getArrowProps()} class='[--arrow-size:8px] [--arrow-background:#111827]'>
            <div {...api().getArrowTipProps()} />
          </div>
          <div
            {...api().getContentProps()}
            class='px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg max-w-xs'
          >
            {content()}
          </div>
        </div>
      </Show>
    </>
  );
}

export default Tooltip;
