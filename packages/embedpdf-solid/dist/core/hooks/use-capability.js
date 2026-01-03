import { createMemo } from 'solid-js';
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
    // Derive capability state reactively from plugin state
    const capabilityState = createMemo(() => {
        const pluginInstance = p.plugin;
        if (!pluginInstance) {
            return {
                provides: null,
                isLoading: p.isLoading,
                ready: p.ready,
            };
        }
        if (!pluginInstance.provides) {
            throw new Error(`Plugin ${pluginId} does not provide a capability`);
        }
        return {
            provides: pluginInstance.provides(),
            isLoading: p.isLoading,
            ready: p.ready,
        };
    });
    return {
        get provides() {
            return capabilityState().provides;
        },
        get isLoading() {
            return capabilityState().isLoading;
        },
        get ready() {
            return capabilityState().ready;
        },
    };
}
//# sourceMappingURL=use-capability.js.map