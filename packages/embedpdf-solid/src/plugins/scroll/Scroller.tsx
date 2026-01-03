import {
  createEffect,
  createRenderEffect,
  onCleanup,
  createMemo,
  Show,
  For,
  type Component,
  type JSX,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { useScrollPlugin } from './hooks/use-scroll-plugin';
import { ScrollStrategy } from '@embedpdf/plugin-scroll';
import type { ScrollerLayout, PageLayout } from '@embedpdf/plugin-scroll';

type KeyedPageLayout = PageLayout & { __key: number };
type KeyedScrollerItem = ScrollerLayout['items'][number] & {
  __key: number;
  pageLayouts: KeyedPageLayout[];
};
type KeyedScrollerLayout = Omit<ScrollerLayout, 'items'> & {
  items: KeyedScrollerItem[];
};

export interface ScrollerProps {
  documentId: string;
  renderPage: (_layout: PageLayout) => JSX.Element;
  class?: string;
  style?: string | JSX.CSSProperties;
}

export const Scroller: Component<ScrollerProps> = props => {
  const pluginState = useScrollPlugin();
  const [layoutData, setLayoutData] = createStore<{
    layout: KeyedScrollerLayout | null;
    docId: string | null;
  }>({ layout: null, docId: null });

  createEffect(() => {
    const plugin = pluginState.plugin;
    const docId = props.documentId;

    if (!plugin || !docId) {
      setLayoutData('layout', null);
      setLayoutData('docId', null);
      return;
    }

    // When we get new data, store it along with the current documentId
    const unsubscribe = plugin.onScrollerData(docId, (newLayout: ScrollerLayout) => {
      // The scroll plugin emits new object graphs frequently during scrolling.
      // Normalize + reconcile by a stable key so Solid can preserve DOM nodes and avoid flashing.
      const normalized: KeyedScrollerLayout = {
        ...newLayout,
        items: newLayout.items.map(
          (item): KeyedScrollerItem => ({
            ...item,
            __key: item.pageNumbers[0],
            pageLayouts: item.pageLayouts.map(
              (pageLayout): KeyedPageLayout => ({
                ...pageLayout,
                __key: pageLayout.pageNumber,
              }),
            ),
          }),
        ),
      };

      setLayoutData('docId', docId);
      setLayoutData('layout', reconcile(normalized, { key: '__key' }));
    });

    onCleanup(() => {
      unsubscribe();
      setLayoutData('layout', null);
      setLayoutData('docId', null);
      plugin.clearLayoutReady(docId);
    });
  });

  // Only use layout if it matches the current documentId (prevents stale data)
  const scrollerLayout = createMemo(() => {
    return layoutData.docId === props.documentId ? layoutData.layout : null;
  });

  // Call setLayoutReady after layout is rendered
  createRenderEffect(() => {
    const plugin = pluginState.plugin;
    const docId = props.documentId;
    const layout = scrollerLayout();

    if (!plugin || !docId || !layout) return;

    plugin.setLayoutReady(docId);
  });

  return (
    <Show when={scrollerLayout()}>
      {layout => {
        // Create reactive accessors that track layout changes
        const l = layout;
        const isHorizontal = () => l().strategy === ScrollStrategy.Horizontal;

        return (
          <div
            style={{
              width: `${l().totalWidth}px`,
              height: `${l().totalHeight}px`,
              position: 'relative',
              'box-sizing': 'border-box',
              margin: '0 auto',
              display: isHorizontal() ? 'flex' : undefined,
              'flex-direction': isHorizontal() ? 'row' : undefined,
              ...(typeof props.style === 'string' ? {} : props.style),
            }}
            class={props.class}
          >
            {/* Leading spacer */}
            <div
              style={{
                width: isHorizontal() ? `${l().startSpacing}px` : '100%',
                height: isHorizontal() ? '100%' : `${l().startSpacing}px`,
                'flex-shrink': isHorizontal() ? '0' : undefined,
              }}
            />

            {/* Page grid */}
            <div
              style={{
                gap: `${l().pageGap}px`,
                display: 'flex',
                'align-items': 'center',
                position: 'relative',
                'box-sizing': 'border-box',
                'flex-direction': isHorizontal() ? 'row' : 'column',
                'min-height': isHorizontal() ? '100%' : undefined,
                'min-width': isHorizontal() ? undefined : 'fit-content',
              }}
            >
              <For each={l().items}>
                {(item: KeyedScrollerItem) => (
                  <div
                    style={{
                      display: 'flex',
                      'justify-content': 'center',
                      gap: `${l().pageGap}px`,
                    }}
                  >
                    <For each={item.pageLayouts}>
                      {(pageLayout: KeyedPageLayout) => (
                        <div
                          style={{
                            width: `${pageLayout.rotatedWidth}px`,
                            height: `${pageLayout.rotatedHeight}px`,
                          }}
                        >
                          {props.renderPage(pageLayout)}
                        </div>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>

            {/* Trailing spacer */}
            <div
              style={{
                width: isHorizontal() ? `${l().endSpacing}px` : '100%',
                height: isHorizontal() ? '100%' : `${l().endSpacing}px`,
                'flex-shrink': isHorizontal() ? '0' : undefined,
              }}
            />
          </div>
        );
      }}
    </Show>
  );
};
