import type { BasePlugin } from '@embedpdf/core';
/**
 * Hook to access a plugin's capability.
 * @param pluginId The ID of the plugin to access
 * @returns The capability provided by the plugin or null during initialization
 * @example
 * // Get zoom capability
 * const zoom = useCapability<ZoomPlugin>(ZoomPlugin.id);
 */
export declare function useCapability<T extends BasePlugin>(pluginId: T['id']): {
    readonly provides: ReturnType<NonNullable<T["provides"]>> | null;
    readonly isLoading: boolean;
    readonly ready: Promise<void>;
};
//# sourceMappingURL=use-capability.d.ts.map