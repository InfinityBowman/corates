import { createContext, useContext, type JSX } from 'solid-js';

export interface ViewportElementRef {
  get current(): HTMLDivElement | null;
}

const ViewportElementContext = createContext<ViewportElementRef | undefined>();

export function useViewportElement(): ViewportElementRef {
  const context = useContext(ViewportElementContext);
  if (!context) {
    throw new Error('useViewportElement must be used inside <Viewport>');
  }
  return context;
}

export function ViewportElementProvider(props: {
  value: ViewportElementRef;
  children: JSX.Element;
}) {
  return (
    <ViewportElementContext.Provider value={props.value}>
      {props.children}
    </ViewportElementContext.Provider>
  );
}
