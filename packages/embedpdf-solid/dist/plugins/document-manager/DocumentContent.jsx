import { createMemo, Show } from 'solid-js';
import { useDocumentState } from '../../core';
/**
 * Headless component for rendering document content with loading/error states
 */
export const DocumentContent = props => {
    const docStateRef = useDocumentState(() => props.documentId);
    const isLoading = createMemo(() => docStateRef.current?.status === 'loading');
    const isError = createMemo(() => docStateRef.current?.status === 'error');
    const isLoaded = createMemo(() => docStateRef.current?.status === 'loaded');
    const renderProps = createMemo(() => {
        const state = docStateRef.current;
        if (!state)
            return null;
        return {
            documentState: state,
            isLoading: isLoading(),
            isError: isError(),
            isLoaded: isLoaded(),
        };
    });
    return <Show when={renderProps()}>{propsValue => props.children(propsValue())}</Show>;
};
//# sourceMappingURL=DocumentContent.jsx.map