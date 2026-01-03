/**
 * Hook to get a ref for the viewport container element with automatic setup/teardown
 * @param getDocumentId Function that returns the document ID
 */
export declare function useViewportRef(getDocumentId: () => string | null): {
    containerRef: import("solid-js").Accessor<HTMLDivElement | null>;
    setContainerRef: import("solid-js").Setter<HTMLDivElement | null>;
};
//# sourceMappingURL=use-viewport-ref.d.ts.map