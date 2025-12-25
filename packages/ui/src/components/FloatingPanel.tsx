/**
 * FloatingPanel component using Ark UI
 */

import { FloatingPanel } from '@ark-ui/solid/floating-panel';
import { Component, Show, JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { AiOutlineMinus, AiOutlineClose } from 'solid-icons/ai';
import { FiMaximize2 } from 'solid-icons/fi';
import { FaSolidWindowRestore } from 'solid-icons/fa';

export interface FloatingPanelSize {
  width: number;
  height: number;
}

export interface FloatingPanelPosition {
  x: number;
  y: number;
}

export interface FloatingPanelProps {
  /** Whether the panel is open (controlled) */
  open?: boolean;
  /** Initial open state (uncontrolled) */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (_details: { open: boolean }) => void;
  /** Panel title */
  title?: string;
  /** Panel content */
  children?: JSX.Element;
  /** Initial size */
  defaultSize?: FloatingPanelSize;
  /** Initial position */
  defaultPosition?: FloatingPanelPosition;
  /** Controlled size */
  size?: FloatingPanelSize;
  /** Controlled position */
  position?: FloatingPanelPosition;
  /** Callback when size changes */
  onSizeChange?: (_details: { size: FloatingPanelSize }) => void;
  /** Callback when position changes */
  onPositionChange?: (_details: { position: FloatingPanelPosition }) => void;
  /** Callback when stage changes */
  onStageChange?: (_details: { stage: 'minimized' | 'maximized' | 'default' }) => void;
  /** Whether the panel can be resized (default: true) */
  resizable?: boolean;
  /** Whether the panel can be dragged (default: true) */
  draggable?: boolean;
  /** Minimum size constraints */
  minSize?: FloatingPanelSize;
  /** Maximum size constraints */
  maxSize?: FloatingPanelSize;
  /** Lock aspect ratio when resizing */
  lockAspectRatio?: boolean;
  /** Show all control buttons (default: true) */
  showControls?: boolean;
  /** Show minimize button (default: true, requires showControls) */
  showMinimize?: boolean;
  /** Show maximize button (default: true, requires showControls) */
  showMaximize?: boolean;
  /** Show restore button (default: true, requires showControls) */
  showRestore?: boolean;
  /** Show close button (default: true, requires showControls) */
  showClose?: boolean;
  /** Close panel on Escape key (default: true) */
  closeOnEscape?: boolean;
  /** Persist size/position when closed (default: false) */
  persistRect?: boolean;
}

/**
 * FloatingPanel - A draggable and resizable floating panel component
 */
const FloatingPanelComponent: Component<FloatingPanelProps> = props => {
  const showControls = () => props.showControls ?? true;
  const showMinimize = () => showControls() && (props.showMinimize ?? true);
  const showMaximize = () => showControls() && (props.showMaximize ?? true);
  const showRestore = () => showControls() && (props.showRestore ?? true);
  const showClose = () => showControls() && (props.showClose ?? true);

  const handleOpenChange = (details: { open: boolean }) => {
    if (props.onOpenChange) {
      props.onOpenChange(details);
    }
  };

  const handleSizeChange = (details: { size: FloatingPanelSize }) => {
    if (props.onSizeChange) {
      props.onSizeChange(details);
    }
  };

  const handlePositionChange = (details: { position: FloatingPanelPosition }) => {
    if (props.onPositionChange) {
      props.onPositionChange(details);
    }
  };

  const handleStageChange = (details: { stage: 'minimized' | 'maximized' | 'default' }) => {
    if (props.onStageChange) {
      props.onStageChange(details);
    }
  };

  const getResizeTriggerStyle = (axis: string): { width?: string; height?: string } => {
    if (axis.length === 1) {
      return axis === 'n' || axis === 's' ? { height: '8px' } : { width: '8px' };
    }
    return { width: '12px', height: '12px' };
  };

  return (
    <FloatingPanel.Root
      open={props.open}
      defaultOpen={props.defaultOpen}
      onOpenChange={handleOpenChange}
      defaultSize={props.defaultSize ?? { width: 320, height: 240 }}
      size={props.size}
      onSizeChange={handleSizeChange}
      defaultPosition={props.defaultPosition}
      position={props.position}
      onPositionChange={handlePositionChange}
      onStageChange={handleStageChange}
      resizable={props.resizable ?? true}
      draggable={props.draggable ?? true}
      minSize={props.minSize ?? { width: 200, height: 150 }}
      maxSize={props.maxSize}
      lockAspectRatio={props.lockAspectRatio ?? false}
      closeOnEscape={props.closeOnEscape ?? true}
      persistRect={props.persistRect ?? false}
    >
      <FloatingPanel.Context>
        {api => (
          <Show when={api().open}>
            <Portal>
              <FloatingPanel.Positioner>
                <FloatingPanel.Content
                  class='relative flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white shadow-2xl'
                  style={{ overflow: 'hidden' }}
                >
                  {/* Header with drag handle */}
                  <FloatingPanel.DragTrigger class='shrink-0'>
                    <FloatingPanel.Header class='flex cursor-move items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 select-none'>
                      <FloatingPanel.Title class='text-sm font-semibold text-gray-900'>
                        {props.title}
                      </FloatingPanel.Title>
                      <Show when={showControls()}>
                        <FloatingPanel.Control class='flex items-center gap-0.5'>
                          <Show when={showMinimize()}>
                            <FloatingPanel.StageTrigger
                              stage='minimized'
                              class='rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700'
                              title='Minimize'
                            >
                              <AiOutlineMinus class='h-3.5 w-3.5' />
                            </FloatingPanel.StageTrigger>
                          </Show>
                          <Show when={showMaximize()}>
                            <FloatingPanel.StageTrigger
                              stage='maximized'
                              class='rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700'
                              title='Maximize'
                            >
                              <FiMaximize2 class='h-3.5 w-3.5' />
                            </FloatingPanel.StageTrigger>
                          </Show>
                          <Show when={showRestore()}>
                            <FloatingPanel.StageTrigger
                              stage='default'
                              class='rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700'
                              title='Restore'
                            >
                              <FaSolidWindowRestore class='h-3.5 w-3.5' />
                            </FloatingPanel.StageTrigger>
                          </Show>
                          <Show when={showClose()}>
                            <FloatingPanel.CloseTrigger
                              class='rounded p-1 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600'
                              title='Close'
                            >
                              <AiOutlineClose class='h-3.5 w-3.5' />
                            </FloatingPanel.CloseTrigger>
                          </Show>
                        </FloatingPanel.Control>
                      </Show>
                    </FloatingPanel.Header>
                  </FloatingPanel.DragTrigger>

                  {/* Body */}
                  <FloatingPanel.Body class='min-h-0 flex-1 overflow-auto p-4'>
                    {props.children}
                  </FloatingPanel.Body>

                  {/* Resize handles */}
                  <Show when={props.resizable ?? true}>
                    <FloatingPanel.ResizeTrigger axis='n' style={getResizeTriggerStyle('n')} />
                    <FloatingPanel.ResizeTrigger axis='e' style={getResizeTriggerStyle('e')} />
                    <FloatingPanel.ResizeTrigger axis='w' style={getResizeTriggerStyle('w')} />
                    <FloatingPanel.ResizeTrigger axis='s' style={getResizeTriggerStyle('s')} />
                    <FloatingPanel.ResizeTrigger axis='ne' style={getResizeTriggerStyle('ne')} />
                    <FloatingPanel.ResizeTrigger axis='se' style={getResizeTriggerStyle('se')} />
                    <FloatingPanel.ResizeTrigger axis='sw' style={getResizeTriggerStyle('sw')} />
                    <FloatingPanel.ResizeTrigger axis='nw' style={getResizeTriggerStyle('nw')} />
                  </Show>
                </FloatingPanel.Content>
              </FloatingPanel.Positioner>
            </Portal>
          </Show>
        )}
      </FloatingPanel.Context>
    </FloatingPanel.Root>
  );
};

export { FloatingPanelComponent as FloatingPanel };
