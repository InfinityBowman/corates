import { createEffect, createSignal, For } from 'solid-js';
import { hasAutoMountElements } from '@embedpdf/core';
import { NestedWrapper } from './nested-wrapper';
/**
 * AutoMount component that automatically mounts DOM elements from plugins.
 * - Utilities: Mounted as standalone components (file pickers, download anchors)
 * - Wrappers: Wraps the viewer content (fullscreen providers, theme providers)
 */
export const AutoMount = props => {
    const [utilities, setUtilities] = createSignal([]);
    const [wrappers, setWrappers] = createSignal([]);
    createEffect(() => {
        const nextUtilities = [];
        const nextWrappers = [];
        for (const reg of props.plugins) {
            const pkg = reg.package;
            if (hasAutoMountElements(pkg)) {
                const elements = pkg.autoMountElements?.() ?? [];
                for (const element of elements) {
                    if (element.type === 'utility') {
                        nextUtilities.push(element.component);
                    }
                    else if (element.type === 'wrapper') {
                        nextWrappers.push(element.component);
                    }
                }
            }
        }
        setUtilities(nextUtilities);
        setWrappers(nextWrappers);
    });
    const wrapperList = wrappers();
    return (<>
      {wrapperList.length > 0 ? (<NestedWrapper wrappers={wrapperList}>{props.children}</NestedWrapper>) : (props.children)}

      {/* Mount all utilities */}
      <For each={utilities()}>
        {Utility => <Utility />}
      </For>
    </>);
};
//# sourceMappingURL=auto-mount.jsx.map