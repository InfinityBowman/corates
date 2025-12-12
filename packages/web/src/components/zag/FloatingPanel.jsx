import * as floatingPanel from '@zag-js/floating-panel';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { AiOutlineMinus } from 'solid-icons/ai';
import { FiMaximize2 } from 'solid-icons/fi';
import { FaSolidWindowRestore } from 'solid-icons/fa';
import { AiOutlineClose } from 'solid-icons/ai';

/**
 * FloatingPanel - A draggable and resizable floating panel component
 *
 * Props:
 * - open: boolean - Whether the panel is open
 * - onOpenChange: (details: { open: boolean }) => void - Callback when open state changes
 * - title: string - Panel title
 * - children: JSX.Element - Panel content
 * - defaultSize: { width: number, height: number } - Initial size
 * - defaultPosition: { x: number, y: number } - Initial position
 * - size: { width: number, height: number } - Controlled size
 * - position: { x: number, y: number } - Controlled position
 * - onSizeChange: (details: { width: number, height: number }) => void
 * - onPositionChange: (details: { x: number, y: number }) => void
 * - onStageChange: (details: { stage: 'minimized' | 'maximized' | 'default' }) => void
 * - resizable: boolean - Whether the panel can be resized (default: true)
 * - draggable: boolean - Whether the panel can be dragged (default: true)
 * - minSize: { width: number, height: number } - Minimum size constraints
 * - maxSize: { width: number, height: number } - Maximum size constraints
 * - lockAspectRatio: boolean - Lock aspect ratio when resizing
 * - showControls: boolean - Show minimize/maximize/close buttons (default: true)
 * - showResizeHandles: boolean - Show resize handles (default: true)
 */
export function FloatingPanel(props) {
  const open = () => props.open;
  const title = () => props.title;
  const children = () => props.children;
  const showControls = () => props.showControls ?? true;
  const showResizeHandles = () => props.showResizeHandles ?? true;

  const service = useMachine(floatingPanel.machine, () => ({
    id: createUniqueId(),
    get open() {
      return open();
    },
    onOpenChange: details => props.onOpenChange?.(details),
    get defaultSize() {
      return props.defaultSize;
    },
    get size() {
      return props.size;
    },
    onSizeChange: details => props.onSizeChange?.(details),
    get defaultPosition() {
      return props.defaultPosition;
    },
    get position() {
      return props.position;
    },
    onPositionChange: details => props.onPositionChange?.(details),
    onStageChange: details => props.onStageChange?.(details),
    get resizable() {
      return props.resizable ?? true;
    },
    get draggable() {
      return props.draggable ?? true;
    },
    get minSize() {
      return props.minSize;
    },
    get maxSize() {
      return props.maxSize;
    },
    get lockAspectRatio() {
      return props.lockAspectRatio ?? false;
    },
  }));

  const api = createMemo(() => floatingPanel.connect(service, normalizeProps));

  return (
    <Show when={api().open}>
      <Portal>
        <div {...api().getPositionerProps()}>
          <div
            {...api().getContentProps()}
            class='bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200'
            style={{
              'min-width': '200px',
              'min-height': '100px',
            }}
          >
            {/* Header with drag handle */}
            <div {...api().getDragTriggerProps()}>
              <div
                {...api().getHeaderProps()}
                class='flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-move'
              >
                <h3 {...api().getTitleProps()} class='text-sm font-semibold text-gray-900'>
                  {title()}
                </h3>
                <Show when={showControls()}>
                  <div {...api().getControlProps()} class='flex items-center gap-1'>
                    <button
                      {...api().getStageTriggerProps({ stage: 'minimized' })}
                      class='p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors'
                      title='Minimize'
                    >
                      <AiOutlineMinus class='w-4 h-4' />
                    </button>
                    <button
                      {...api().getStageTriggerProps({ stage: 'maximized' })}
                      class='p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors'
                      title='Maximize'
                    >
                      <FiMaximize2 class='w-4 h-4' />
                    </button>
                    <button
                      {...api().getStageTriggerProps({ stage: 'default' })}
                      class='p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors'
                      title='Restore'
                    >
                      <FaSolidWindowRestore class='w-4 h-4' />
                    </button>
                    <button
                      {...api().getCloseTriggerProps()}
                      class='p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors'
                      title='Close'
                    >
                      <AiOutlineClose class='w-4 h-4' />
                    </button>
                  </div>
                </Show>
              </div>
            </div>

            {/* Body */}
            <div {...api().getBodyProps()} class='p-4 overflow-auto'>
              {children()}
            </div>

            {/* Resize handles */}
            <Show when={showResizeHandles() && api().resizable}>
              {/* Edge handles */}
              <div
                {...api().getResizeTriggerProps({ axis: 'n' })}
                class='absolute top-0 left-0 right-0 h-1 cursor-ns-resize'
              />
              <div
                {...api().getResizeTriggerProps({ axis: 'e' })}
                class='absolute top-0 right-0 bottom-0 w-1 cursor-ew-resize'
              />
              <div
                {...api().getResizeTriggerProps({ axis: 'w' })}
                class='absolute top-0 left-0 bottom-0 w-1 cursor-ew-resize'
              />
              <div
                {...api().getResizeTriggerProps({ axis: 's' })}
                class='absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize'
              />

              {/* Corner handles */}
              <div
                {...api().getResizeTriggerProps({ axis: 'ne' })}
                class='absolute top-0 right-0 w-3 h-3 cursor-ne-resize'
              />
              <div
                {...api().getResizeTriggerProps({ axis: 'se' })}
                class='absolute bottom-0 right-0 w-3 h-3 cursor-se-resize'
              />
              <div
                {...api().getResizeTriggerProps({ axis: 'sw' })}
                class='absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize'
              />
              <div
                {...api().getResizeTriggerProps({ axis: 'nw' })}
                class='absolute top-0 left-0 w-3 h-3 cursor-nw-resize'
              />
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

export default FloatingPanel;
