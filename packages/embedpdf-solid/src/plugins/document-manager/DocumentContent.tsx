import { createMemo, Show, type Component, type JSX } from 'solid-js';
import { useDocumentState } from '../../core';
import type { DocumentState } from '@embedpdf/core';

export interface DocumentContentRenderProps {
  documentState: DocumentState;
  isLoading: boolean;
  isError: boolean;
  isLoaded: boolean;
}

export interface DocumentContentProps {
  documentId: string | null;
  children: (_props: DocumentContentRenderProps) => JSX.Element;
}

/**
 * Headless component for rendering document content with loading/error states
 */
export const DocumentContent: Component<DocumentContentProps> = props => {
  const docStateRef = useDocumentState(() => props.documentId);

  const isLoading = createMemo(() => docStateRef.current?.status === 'loading');
  const isError = createMemo(() => docStateRef.current?.status === 'error');
  const isLoaded = createMemo(() => docStateRef.current?.status === 'loaded');

  const renderProps = createMemo((): DocumentContentRenderProps | null => {
    const state = docStateRef.current;
    if (!state) return null;
    return {
      documentState: state,
      isLoading: isLoading(),
      isError: isError(),
      isLoaded: isLoaded(),
    };
  });

  return <Show when={renderProps()}>{propsValue => props.children(propsValue())}</Show>;
};
