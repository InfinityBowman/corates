import { createSignal, createEffect } from 'solid-js';
import { usePlugin } from './use-plugin';
/**
 * Hook to access a plugin's capability.
 * @param pluginId The ID of the plugin to access
 * @returns The capability provided by the plugin or null during initialization
 * @example
 * // Get zoom capability
 * const zoom = useCapability<ZoomPlugin>(ZoomPlugin.id);
 */
export function useCapability(pluginId) {
    const p = usePlugin(pluginId);
    const [provides, setProvides] = createSignal(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [ready, setReady] = createSignal(Promise.resolve());
    createEffect(() => {
        const pluginInstance = p.plugin;
        if (!pluginInstance) {
            setProvides(null);
            setIsLoading(p.isLoading);
            setReady(p.ready);
            return;
        }
        if (!pluginInstance.provides) {
            throw new Error(`Plugin ${pluginId} does not provide a capability`);
        }
        setProvides(pluginInstance.provides());
        setIsLoading(p.isLoading);
        setReady(p.ready);
    });
    return {
        get provides() {
            return provides();
        },
        get isLoading() {
            return isLoading();
        },
        get ready() {
            return ready();
        },
    };
}
//# sourceMappingURL=use-capability.js.map