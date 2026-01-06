/**
 * Splitter component using Ark UI
 */

import { Splitter } from '@ark-ui/solid/splitter';
import { Component } from 'solid-js';

export interface SplitterPanel {
  id: string;
  minSize?: number;
  maxSize?: number;
}

export interface SplitterProps {
  /** Default panel sizes as percentages */
  defaultSize?: number[];
  /** Panel configurations */
  panels?: SplitterPanel[];
  /** Orientation (default: 'horizontal') */
  orientation?: 'horizontal' | 'vertical';
  /** Additional class for root element */
  class?: string;
}

/**
 * Splitter - Resizable panel splitter
 */
const SplitterComponent: Component<SplitterProps> = props => {
  return (
    <Splitter.Root
      panels={
        props.panels || [
          { id: 'a', minSize: 10 },
          { id: 'b', minSize: 10 },
        ]
      }
      defaultSize={props.defaultSize || [80, 20]}
      orientation={props.orientation || 'horizontal'}
      class={props.class}
    >
      <Splitter.Panel id='a'>
        <p>A</p>
      </Splitter.Panel>
      <Splitter.ResizeTrigger id='a:b' aria-label='Resize' />
      <Splitter.Panel id='b'>
        <p>B</p>
      </Splitter.Panel>
    </Splitter.Root>
  );
};

export { SplitterComponent as Splitter };

// Export raw Ark UI primitive for custom layouts
export { Splitter as SplitterPrimitive };
