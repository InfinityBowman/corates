import { createContext, useContext } from 'solid-js';
const ViewportElementContext = createContext();
export function useViewportElement() {
    const context = useContext(ViewportElementContext);
    if (!context) {
        throw new Error('useViewportElement must be used inside <Viewport>');
    }
    return context;
}
export function ViewportElementProvider(props) {
    return (<ViewportElementContext.Provider value={props.value}>
      {props.children}
    </ViewportElementContext.Provider>);
}
//# sourceMappingURL=context.jsx.map