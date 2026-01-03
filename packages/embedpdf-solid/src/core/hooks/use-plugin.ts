import { createSignal, createEffect } from 'solid-js';
import { useRegistry } from './use-registry';
import type { BasePlugin } from '@embedpdf/core';

/**
 * Hook to access a plugin.
 * @param pluginId The ID of the plugin to access
 * @returns The plugin state with plugin, isLoading, and ready
 * @example
 * // Get zoom plugin
 * const zoom = usePlugin<ZoomPlugin>(ZoomPlugin.id);
 */
export function usePlugin<T extends BasePlugin>(pluginId: T['id']) {
  const [plugin, setPlugin] = createSignal<T | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [ready, setReady] = createSignal<Promise<void>>(Promise.resolve());

  createEffect(() => {
    // Read from context inside the reactive scope so updates to the provider value
    // (registry becoming non-null after initialization) retrigger this effect.
    const registry = useRegistry().registry;

    if (registry === null) {
      setPlugin(null);
      setIsLoading(true);
      setReady(Promise.resolve());
      return;
    }

    const pluginInstance = registry.getPlugin<T>(pluginId);

    if (!pluginInstance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    setPlugin(() => pluginInstance);
    setIsLoading(false);
    setReady(pluginInstance.ready());
  });

  return {
    get plugin() {
      return plugin();
    },
    get isLoading() {
      return isLoading();
    },
    get ready() {
      return ready();
    },
  };
}
