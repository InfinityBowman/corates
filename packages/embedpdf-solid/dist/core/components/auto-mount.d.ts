import { type Component, type JSX } from 'solid-js';
import { type PluginBatchRegistrations } from '@embedpdf/core';
export interface AutoMountProps {
    plugins: PluginBatchRegistrations;
    children: JSX.Element;
}
/**
 * AutoMount component that automatically mounts DOM elements from plugins.
 * - Utilities: Mounted as standalone components (file pickers, download anchors)
 * - Wrappers: Wraps the viewer content (fullscreen providers, theme providers)
 */
export declare const AutoMount: Component<AutoMountProps>;
//# sourceMappingURL=auto-mount.d.ts.map