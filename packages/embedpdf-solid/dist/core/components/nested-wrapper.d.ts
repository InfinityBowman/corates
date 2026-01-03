import { type Component, type JSX } from 'solid-js';
export interface NestedWrapperProps {
    wrappers: Component<{
        children: JSX.Element;
    }>[];
    children: JSX.Element;
}
/**
 * Recursively wraps children in a chain of wrapper components.
 * Used by AutoMount to nest wrapper components in registration order.
 */
export declare const NestedWrapper: Component<NestedWrapperProps>;
//# sourceMappingURL=nested-wrapper.d.ts.map