import { ViewportPlugin } from '@embedpdf/plugin-viewport';
export declare const useViewportPlugin: () => {
    readonly plugin: ViewportPlugin | null;
    readonly isLoading: boolean;
    readonly ready: Promise<void>;
};
export declare const useViewportCapability: () => {
    readonly provides: Readonly<import("@embedpdf/plugin-viewport").ViewportCapability> | null;
    readonly isLoading: boolean;
    readonly ready: Promise<void>;
};
//# sourceMappingURL=use-viewport.d.ts.map