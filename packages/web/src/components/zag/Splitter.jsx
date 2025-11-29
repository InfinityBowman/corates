import * as splitter from '@zag-js/splitter';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId } from 'solid-js';

/**
 * Zag.js Splitter component for resizable panels
 * @param {Object} props
 * @param {string} props.id - Unique ID for the splitter
 * @param {'horizontal'|'vertical'} props.orientation - Panel orientation
 * @param {number[]} props.defaultSize - Initial sizes as percentages (must total 100)
 * @param {Array<{id: string, minSize?: number, maxSize?: number}>} props.panels - Panel configurations
 * @param {Function} props.onResizeEnd - Callback when resize ends
 * @param {Function} props.children - Render prop receiving the API
 */
export default function Splitter(props) {
  const service = useMachine(splitter.machine, () => ({
    id: props.id || createUniqueId(),
    orientation: props.orientation || 'horizontal',
    defaultSize: props.defaultSize,
    panels: props.panels,
    onResizeEnd(details) {
      props.onResizeEnd?.(details);
    },
  }));

  const api = createMemo(() => splitter.connect(service, normalizeProps));

  return props.children?.(api());
}

/**
 * Convenience components for Splitter parts
 */
export function SplitterRoot(props) {
  return (
    <div {...props.api.getRootProps()} class={props.class}>
      {props.children}
    </div>
  );
}

export function SplitterPanel(props) {
  return (
    <div {...props.api.getPanelProps({ id: props.id })} class={props.class}>
      {props.children}
    </div>
  );
}

export function SplitterResizeTrigger(props) {
  const ids = () => `${props.beforeId}:${props.afterId}`;

  return (
    <div {...props.api.getResizeTriggerProps({ id: ids() })} class={props.class}>
      {props.children}
    </div>
  );
}
