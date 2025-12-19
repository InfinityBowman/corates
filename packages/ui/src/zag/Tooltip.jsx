import * as tooltip from '@zag-js/tooltip';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Z_INDEX } from '../constants/zIndex.js';

export function Tooltip(props) {
  const service = useMachine(tooltip.machine, () => ({
    id: createUniqueId(),
    positioning: {
      placement: props.placement || 'top',
      gutter: 8,
      strategy: 'fixed', // Use fixed positioning to avoid stacking context issues
    },
    openDelay: props.openDelay ?? 100,
    closeDelay: props.closeDelay ?? 100,
    interactive: props.interactive ?? false,
  }));

  const api = createMemo(() => tooltip.connect(service, normalizeProps));

  return (
    <>
      <span {...api().getTriggerProps()}>{props.children}</span>
      <Show when={api().open}>
        <Portal>
          <div {...api().getPositionerProps()} class={Z_INDEX.TOOLTIP}>
            <div {...api().getArrowProps()} class='[--arrow-background:#111827] [--arrow-size:8px]'>
              <div {...api().getArrowTipProps()} />
            </div>
            <div
              {...api().getContentProps()}
              class='pointer-events-none max-w-xs rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg'
            >
              {props.content}
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
}

export default Tooltip;
