import type { BasePlugin } from '@embedpdf/core';
/**
 * Hook to access a plugin.
 * @param pluginId The ID of the plugin to access
 * @returns The plugin state with plugin, isLoading, and ready
 * @example
 * // Get zoom plugin
 * const zoom = usePlugin<ZoomPlugin>(ZoomPlugin.id);
 */
export declare function usePlugin<T extends BasePlugin>(pluginId: T['id']): {
    readonly plugin: T | null;
    readonly isLoading: boolean;
    readonly ready: Promise<void>;
};
//# sourceMappingURL=use-plugin.d.ts.map