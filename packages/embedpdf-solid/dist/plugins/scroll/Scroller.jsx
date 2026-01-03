import { createSignal, createEffect, onCleanup, For, createMemo, Show, } from 'solid-js';
import { useScrollPlugin } from './hooks/use-scroll-plugin';
import { ScrollStrategy } from '@embedpdf/plugin-scroll';
export const Scroller = props => {
    const pluginState = useScrollPlugin();
    const [layoutData, setLayoutData] = createSignal({ layout: null, docId: null });
    createEffect(() => {
        const plugin = pluginState.plugin;
        const docId = props.documentId;
        if (!plugin || !docId) {
            setLayoutData({ layout: null, docId: null });
            return;
        }
        // When we get new data, store it along with the current documentId
        const unsubscribe = plugin.onScrollerData(docId, (newLayout) => {
            setLayoutData({ layout: newLayout, docId });
        });
        onCleanup(() => {
            unsubscribe();
            setLayoutData({ layout: null, docId: null });
            plugin.clearLayoutReady(docId);
        });
    });
    // Only use layout if it matches the current documentId (prevents stale data)
    const scrollerLayout = createMemo(() => {
        const data = layoutData();
        return data.docId === props.documentId ? data.layout : null;
    });
    // Call setLayoutReady after layout is rendered
    createEffect(() => {
        const plugin = pluginState.plugin;
        const docId = props.documentId;
        const layout = scrollerLayout();
        if (!plugin || !docId || !layout)
            return;
        plugin.setLayoutReady(docId);
    });
    return (<Show when={scrollerLayout()}>
      {layout => {
            const l = layout();
            return (<div style={{
                    width: `${l.totalWidth}px`,
                    height: `${l.totalHeight}px`,
                    position: 'relative',
                    'box-sizing': 'border-box',
                    margin: '0 auto',
                    display: l.strategy === ScrollStrategy.Horizontal ? 'flex' : undefined,
                    'flex-direction': l.strategy === ScrollStrategy.Horizontal ? 'row' : undefined,
                    ...(typeof props.style === 'string' ? {} : props.style),
                }} class={props.class}>
            {/* Leading spacer */}
            <div style={{
                    width: l.strategy === ScrollStrategy.Horizontal ? `${l.startSpacing}px` : '100%',
                    height: l.strategy === ScrollStrategy.Horizontal ? '100%' : `${l.startSpacing}px`,
                    'flex-shrink': l.strategy === ScrollStrategy.Horizontal ? '0' : undefined,
                }}/>

            {/* Page grid */}
            <div style={{
                    gap: `${l.pageGap}px`,
                    display: 'flex',
                    'align-items': 'center',
                    position: 'relative',
                    'box-sizing': 'border-box',
                    'flex-direction': l.strategy === ScrollStrategy.Horizontal ? 'row' : 'column',
                    'min-height': l.strategy === ScrollStrategy.Horizontal ? '100%' : undefined,
                    'min-width': l.strategy === ScrollStrategy.Horizontal ? undefined : 'fit-content',
                }}>
              <For each={l.items}>
                {item => (<div style={{
                        display: 'flex',
                        'justify-content': 'center',
                        gap: `${l.pageGap}px`,
                    }}>
                    <For each={item.pageLayouts}>
                      {pageLayout => (<div style={{
                            width: `${pageLayout.rotatedWidth}px`,
                            height: `${pageLayout.rotatedHeight}px`,
                        }}>
                          {props.renderPage(pageLayout)}
                        </div>)}
                    </For>
                  </div>)}
              </For>
            </div>

            {/* Trailing spacer */}
            <div style={{
                    width: l.strategy === ScrollStrategy.Horizontal ? `${l.endSpacing}px` : '100%',
                    height: l.strategy === ScrollStrategy.Horizontal ? '100%' : `${l.endSpacing}px`,
                    'flex-shrink': l.strategy === ScrollStrategy.Horizontal ? '0' : undefined,
                }}/>
          </div>);
        }}
    </Show>);
};
//# sourceMappingURL=Scroller.jsx.map