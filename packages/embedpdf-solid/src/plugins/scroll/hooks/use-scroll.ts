import { createSignal, createEffect, createMemo, onCleanup } from 'solid-js';
import { useCapability } from '../../../core';
import { ScrollPlugin } from '@embedpdf/plugin-scroll';
import type { ScrollScope } from '@embedpdf/plugin-scroll';

export const useScrollCapability = () => useCapability<ScrollPlugin>(ScrollPlugin.id);

export interface UseScrollReturn {
  provides: ScrollScope | null;
  state: {
    currentPage: number;
    totalPages: number;
  };
}

/**
 * Hook for scroll state for a specific document
 * @param getDocumentId Function that returns the document ID
 */
export function useScroll(getDocumentId: () => string | null): UseScrollReturn {
  const capabilityState = useScrollCapability();
  const [currentPage, setCurrentPage] = createSignal(1);
  const [totalPages, setTotalPages] = createSignal(1);

  createEffect(() => {
    const provides = capabilityState.provides;
    const docId = getDocumentId();

    if (!provides || !docId) {
      setCurrentPage(1);
      setTotalPages(1);
      return;
    }

    const scope = provides.forDocument(docId);

    // Initial values
    setCurrentPage(scope.getCurrentPage());
    setTotalPages(scope.getTotalPages());

    // Subscribe to page changes for THIS docId
    const unsubscribe = provides.onPageChange(
      (event: { documentId: string; pageNumber: number; totalPages: number }) => {
        if (event.documentId === docId) {
          setCurrentPage(event.pageNumber);
          setTotalPages(event.totalPages);
        }
      },
    );

    onCleanup(() => {
      unsubscribe();
    });
  });

  const scopedProvides = createMemo(() => {
    const provides = capabilityState.provides;
    const docId = getDocumentId();
    return provides && docId ? provides.forDocument(docId) : null;
  });

  return {
    get provides() {
      return scopedProvides();
    },
    get state() {
      return {
        currentPage: currentPage(),
        totalPages: totalPages(),
      };
    },
  };
}
