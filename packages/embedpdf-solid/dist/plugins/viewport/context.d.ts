import { type JSX } from 'solid-js';
export interface ViewportElementRef {
    get current(): HTMLDivElement | null;
}
export declare function useViewportElement(): ViewportElementRef;
export declare function ViewportElementProvider(props: {
    value: ViewportElementRef;
    children: JSX.Element;
}): JSX.Element;
//# sourceMappingURL=context.d.ts.map