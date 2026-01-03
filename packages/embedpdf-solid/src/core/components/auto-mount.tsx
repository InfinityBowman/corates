import { createEffect, createSignal, For, type Component, type JSX } from 'solid-js';
import { hasAutoMountElements, type PluginBatchRegistrations } from '@embedpdf/core';
import { NestedWrapper } from './nested-wrapper';

export interface AutoMountProps {
  plugins: PluginBatchRegistrations;
  children: JSX.Element;
}

/**
 * AutoMount component that automatically mounts DOM elements from plugins.
 * - Utilities: Mounted as standalone components (file pickers, download anchors)
 * - Wrappers: Wraps the viewer content (fullscreen providers, theme providers)
 */
export const AutoMount: Component<AutoMountProps> = props => {
  const [utilities, setUtilities] = createSignal<any[]>([]);
  const [wrappers, setWrappers] = createSignal<any[]>([]);

  createEffect(() => {
    const nextUtilities: any[] = [];
    const nextWrappers: any[] = [];

    for (const reg of props.plugins) {
      const pkg = reg.package;
      if (hasAutoMountElements(pkg)) {
        const elements = pkg.autoMountElements?.() ?? [];
        for (const element of elements) {
          if (element.type === 'utility') {
            nextUtilities.push(element.component);
          } else if (element.type === 'wrapper') {
            nextWrappers.push(element.component);
          }
        }
      }
    }

    setUtilities(nextUtilities);
    setWrappers(nextWrappers);
  });

  const wrapperList = wrappers();

  return (
    <>
      {wrapperList.length > 0 ?
        <NestedWrapper wrappers={wrapperList}>{props.children}</NestedWrapper>
      : props.children}

      {/* Mount all utilities */}
      <For each={utilities()}>{Utility => <Utility />}</For>
    </>
  );
};
