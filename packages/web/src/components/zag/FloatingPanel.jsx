import * as floatingPanel from '@zag-js/floating-panel';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { AiOutlineMinus, AiOutlineClose } from 'solid-icons/ai';
import { FiMaximize2 } from 'solid-icons/fi';
import { FaSolidWindowRestore } from 'solid-icons/fa';

/**
 * FloatingPanel - A draggable and resizable floating panel component
 *
 * Props:
 * - open: boolean - Whether the panel is open (controlled)
 * - defaultOpen: boolean - Initial open state (uncontrolled)
 * - onOpenChange: (details: { open: boolean }) => void - Callback when open state changes
 * - title: string - Panel title
 * - children: JSX.Element - Panel content
 * - defaultSize: { width: number, height: number } - Initial size
 * - defaultPosition: { x: number, y: number } - Initial position
 * - size: { width: number, height: number } - Controlled size
 * - position: { x: number, y: number } - Controlled position
 * - onSizeChange: (details: SizeChangeDetails) => void
 * - onPositionChange: (details: PositionChangeDetails) => void
 * - onStageChange: (details: { stage: 'minimized' | 'maximized' | 'default' }) => void
 * - resizable: boolean - Whether the panel can be resized (default: true)
 * - draggable: boolean - Whether the panel can be dragged (default: true)
 * - minSize: { width: number, height: number } - Minimum size constraints
 * - maxSize: { width: number, height: number } - Maximum size constraints
 * - lockAspectRatio: boolean - Lock aspect ratio when resizing
 * - showControls: boolean - Show all control buttons (default: true)
 * - showMinimize: boolean - Show minimize button (default: true, requires showControls)
 * - showMaximize: boolean - Show maximize button (default: true, requires showControls)
 * - showRestore: boolean - Show restore button (default: true, requires showControls)
 * - showClose: boolean - Show close button (default: true, requires showControls)
 * - closeOnEscape: boolean - Close panel on Escape key (default: true)
 * - persistRect: boolean - Persist size/position when closed (default: false)
 */
export function FloatingPanel(props) {
  const service = useMachine(floatingPanel.machine, () => ({
    id: createUniqueId(),
    open: props.open,
    defaultOpen: props.defaultOpen,
    onOpenChange: details => props.onOpenChange?.(details),
    defaultSize: props.defaultSize ?? { width: 320, height: 240 },
    size: props.size,
    onSizeChange: details => props.onSizeChange?.(details),
    defaultPosition: props.defaultPosition,
    position: props.position,
    onPositionChange: details => props.onPositionChange?.(details),
    onStageChange: details => props.onStageChange?.(details),
    resizable: props.resizable ?? true,
    draggable: props.draggable ?? true,
    minSize: props.minSize ?? { width: 200, height: 150 },
    maxSize: props.maxSize,
    lockAspectRatio: props.lockAspectRatio ?? false,
    closeOnEscape: props.closeOnEscape ?? true,
    persistRect: props.persistRect ?? false,
  }));

  const api = createMemo(() => floatingPanel.connect(service, normalizeProps));
  const showControls = () => props.showControls ?? true;
  const showMinimize = () => showControls() && (props.showMinimize ?? true);
  const showMaximize = () => showControls() && (props.showMaximize ?? true);
  const showRestore = () => showControls() && (props.showRestore ?? true);
  const showClose = () => showControls() && (props.showClose ?? true);

  // Helper to merge Zag's style with custom style
  const contentProps = () => {
    const cp = api().getContentProps();
    return {
      ...cp,
      onKeyDown: event => {
        // Let Zag handle its own key bindings first.
        // Note: Zag's default handler only runs when the content element itself
        // is the event target, so Escape won't close when a child has focus.
        cp.onKeyDown?.(event);
        if (!(props.closeOnEscape ?? true)) return;
        if (event.key !== 'Escape' && event.key !== 'Esc') return;
        event.stopPropagation();
        event.preventDefault();
        api().setOpen(false);
      },
      style: { ...cp.style, overflow: 'hidden' },
    };
  };

  const resizeTrigger = axis => {
    const rp = api().getResizeTriggerProps({ axis });
    const extraStyle =
      axis.length === 1 ?
        axis === 'n' || axis === 's' ?
          { height: '8px' }
        : { width: '8px' }
      : { width: '12px', height: '12px' };
    return { ...rp, style: { ...rp.style, ...extraStyle } };
  };

  return (
    <Show when={api().open}>
      <Portal>
        <div {...api().getPositionerProps()}>
          <div
            {...contentProps()}
            class='bg-white rounded-lg shadow-2xl border border-gray-200 relative'
          >
            {/* Header with drag handle */}
            <div {...api().getDragTriggerProps()}>
              <div
                {...api().getHeaderProps()}
                class='flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 cursor-move select-none'
              >
                <h3 {...api().getTitleProps()} class='text-sm font-semibold text-gray-900'>
                  {props.title}
                </h3>
                <Show when={showControls()}>
                  <div {...api().getControlProps()} class='flex items-center gap-0.5'>
                    <Show when={showMinimize()}>
                      <button
                        {...api().getStageTriggerProps({ stage: 'minimized' })}
                        class='p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors'
                        title='Minimize'
                      >
                        <AiOutlineMinus class='w-3.5 h-3.5' />
                      </button>
                    </Show>
                    <Show when={showMaximize()}>
                      <button
                        {...api().getStageTriggerProps({ stage: 'maximized' })}
                        class='p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors'
                        title='Maximize'
                      >
                        <FiMaximize2 class='w-3.5 h-3.5' />
                      </button>
                    </Show>
                    <Show when={showRestore()}>
                      <button
                        {...api().getStageTriggerProps({ stage: 'default' })}
                        class='p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors'
                        title='Restore'
                      >
                        <FaSolidWindowRestore class='w-3.5 h-3.5' />
                      </button>
                    </Show>
                    <Show when={showClose()}>
                      <button
                        {...api().getCloseTriggerProps()}
                        class='p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors'
                        title='Close'
                      >
                        <AiOutlineClose class='w-3.5 h-3.5' />
                      </button>
                    </Show>
                  </div>
                </Show>
              </div>
            </div>

            {/* Body */}
            <div {...api().getBodyProps()} class='p-4 overflow-auto'>
              {props.children}
            </div>

            {/* Resize handles - merge Zag's styles with our size overrides */}
            <Show when={props.resizable ?? true}>
              <div {...resizeTrigger('n')} />
              <div {...resizeTrigger('e')} />
              <div {...resizeTrigger('w')} />
              <div {...resizeTrigger('s')} />
              <div {...resizeTrigger('ne')} />
              <div {...resizeTrigger('se')} />
              <div {...resizeTrigger('sw')} />
              <div {...resizeTrigger('nw')} />
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

export default FloatingPanel;
