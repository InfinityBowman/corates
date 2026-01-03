import { createMemo } from 'solid-js';
import { useRegistry } from './use-registry';
/**
 * Hook to access a plugin.
 * @param pluginId The ID of the plugin to access
 * @returns The plugin state with plugin, isLoading, and ready
 * @example
 * // Get zoom plugin
 * const zoom = usePlugin<ZoomPlugin>(ZoomPlugin.id);
 */
export function usePlugin(pluginId) {
    // Get context at hook level - the context value contains reactive getters
    const context = useRegistry();
    // Derive plugin state reactively from context
    const pluginState = createMemo(() => {
        const registry = context.registry;
        if (registry === null) {
            return {
                plugin: null,
                isLoading: true,
                ready: Promise.resolve(),
            };
        }
        const pluginInstance = registry.getPlugin(pluginId);
        if (!pluginInstance) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        return {
            plugin: pluginInstance,
            isLoading: false,
            ready: pluginInstance.ready(),
        };
    });
    return {
        get plugin() {
            return pluginState().plugin;
        },
        get isLoading() {
            return pluginState().isLoading;
        },
        get ready() {
            return pluginState().ready;
        },
    };
}
//# sourceMappingURL=use-plugin.js.map