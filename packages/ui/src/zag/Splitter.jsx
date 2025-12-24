/**
 * Splitter component using Ark UI
 */

import { Splitter } from '@ark-ui/solid/splitter';

export default function SplitterComponent() {
  return (
    <Splitter.Root
      panels={[
        { id: 'a', minSize: 10 },
        { id: 'b', minSize: 10 },
      ]}
      defaultSize={[80, 20]}
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
}

export { SplitterComponent as Splitter };
