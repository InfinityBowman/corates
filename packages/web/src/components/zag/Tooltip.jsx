import * as tooltip from '@zag-js/tooltip';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, Show } from 'solid-js';

export function Tooltip(props) {
  const service = useMachine(tooltip.machine, () => ({
    id: createUniqueId(),
    positioning: {
      placement: props.placement || 'top',
    },
    openDelay: props.openDelay ?? 100,
    closeDelay: props.closeDelay ?? 0,
  }));

  const api = createMemo(() => tooltip.connect(service, normalizeProps));

  return (
    <>
      <span {...api().getTriggerProps()}>{props.children}</span>
      <Show when={api().open}>
        <div {...api().getPositionerProps()}>
          <div {...api().getArrowProps()} class='[--arrow-size:8px] [--arrow-background:#111827]'>
            <div {...api().getArrowTipProps()} />
          </div>
          <div
            {...api().getContentProps()}
            class='px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg max-w-xs'
          >
            {props.content}
          </div>
        </div>
      </Show>
    </>
  );
}

export default Tooltip;
