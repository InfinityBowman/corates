import { createMemo } from 'solid-js';
import { useCoreState } from './use-core-state';
import type { DocumentState } from '@embedpdf/core';

/**
 * Hook that provides reactive access to a specific document's state from the core store.
 *
 * @param getDocumentId Function that returns the document ID
 * @returns The reactive DocumentState object or null if not found.
 */
export function useDocumentState(getDocumentId: () => string | null) {
  const coreStateRef = useCoreState();

  // Reactive documentId
  const documentId = createMemo(() => getDocumentId());

  const documentState = createMemo((): DocumentState | null => {
    const coreState = coreStateRef.current;
    const docId = documentId();
    return coreState && docId ? (coreState.documents[docId] ?? null) : null;
  });

  return {
    get current() {
      return documentState();
    },
  };
}
