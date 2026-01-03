/**
 * EmbedPdfViewerHeadless - Headless PDF viewer using EmbedPDF Solid adapters
 * Renders PDF without the snippet viewer UI, using only the core rendering engine
 */

import { Show, createMemo } from 'solid-js';
import { createPluginRegistration } from '@embedpdf/core';
import { EmbedPDF } from '@corates/embedpdf-solid/core';
import { createPdfiumEngine } from '@corates/embedpdf-solid/engines';
import { DocumentContent } from '@corates/embedpdf-solid/plugins/document-manager';
import { Viewport } from '@corates/embedpdf-solid/plugins/viewport';
import { Scroller } from '@corates/embedpdf-solid/plugins/scroll';
import { RenderLayer } from '@corates/embedpdf-solid/plugins/render';
import { useZoom, ZoomGestureWrapper } from '@corates/embedpdf-solid/plugins/zoom';
import { DocumentManagerPluginPackage } from '@embedpdf/plugin-document-manager';
import { ViewportPluginPackage } from '@embedpdf/plugin-viewport';
import { ScrollPluginPackage } from '@embedpdf/plugin-scroll';
import { RenderPluginPackage } from '@embedpdf/plugin-render';
import { ZoomPluginPackage } from '@embedpdf/plugin-zoom';
import { EMBEDPDF_PDFIUM_WASM_URL } from '@config/pdfViewer';

/**
 * Inner viewer component that handles the EmbedPDF rendering.
 * Separated to allow keying on documentId for clean re-initialization.
 */
function HeadlessViewerInner(props) {
  // props.engine - PdfEngine instance
  // props.pdfData - ArrayBuffer of PDF data
  // props.pdfFileName - Name of the PDF file
  // props.documentId - Document ID

  // Create plugins once per instance with initialDocuments.
  // Props are captured intentionally - component is keyed and recreated when doc changes.
  const plugins = [
    createPluginRegistration(DocumentManagerPluginPackage, {
      initialDocuments: [
        {
          buffer: props.pdfData,
          name: props.pdfFileName || 'document.pdf',
          documentId: props.documentId,
          autoActivate: true,
        },
      ],
    }),
    createPluginRegistration(ViewportPluginPackage),
    createPluginRegistration(ScrollPluginPackage),
    createPluginRegistration(RenderPluginPackage),
    createPluginRegistration(ZoomPluginPackage, {
      defaultZoomLevel: 'automatic',
      minZoom: 0.25,
      maxZoom: 4,
      zoomStep: 0.1,
    }),
  ];

  // Use the documentId we know (from props) rather than relying on context
  // This avoids reactivity issues with the render-prop pattern in Solid
  const docId = props.documentId;

  return (
    <EmbedPDF engine={props.engine} plugins={plugins}>
      {context => (
        <Show
          when={context.pluginsReady}
          fallback={
            <div class='flex h-full items-center justify-center'>
              <div class='text-center text-gray-500'>
                <p>Initializing...</p>
              </div>
            </div>
          }
        >
          <DocumentContent documentId={docId}>
            {docProps => (
              <Show
                when={docProps.isLoaded}
                fallback={
                  <Show
                    when={docProps.isError}
                    fallback={
                      <div class='flex h-full items-center justify-center'>
                        <div class='text-center text-gray-500'>
                          <p>Loading PDF...</p>
                        </div>
                      </div>
                    }
                  >
                    <div class='flex h-full items-center justify-center'>
                      <div class='text-center text-red-500'>
                        <p>Error loading PDF</p>
                      </div>
                    </div>
                  </Show>
                }
              >
                <div class='relative h-full w-full'>
                  <Viewport documentId={docId} class='h-full w-full bg-gray-200'>
                    <ZoomGestureWrapper documentId={docId} enablePinch={false} enableWheel={true}>
                      <Scroller
                        documentId={docId}
                        renderPage={pageLayout => (
                          <RenderLayer documentId={docId} pageIndex={pageLayout.pageIndex} />
                        )}
                      />
                    </ZoomGestureWrapper>
                  </Viewport>
                  <ZoomControls documentId={docId} />
                </div>
              </Show>
            )}
          </DocumentContent>
        </Show>
      )}
    </EmbedPDF>
  );
}

/**
 * Zoom controls overlay component
 */
function ZoomControls(props) {
  const { state, provides } = useZoom(() => props.documentId);

  const zoomPercent = createMemo(() => Math.round(state().currentZoomLevel * 100));

  const handleZoomOut = () => {
    const zoomScope = provides();
    if (zoomScope) {
      zoomScope.zoomOut();
    }
  };

  const handleZoomIn = () => {
    const zoomScope = provides();
    if (zoomScope) {
      zoomScope.zoomIn();
    }
  };

  return (
    <div class='absolute right-4 bottom-4 z-10 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 shadow-lg backdrop-blur-sm'>
      <button
        type='button'
        onClick={handleZoomOut}
        class='flex h-8 w-8 items-center justify-center rounded hover:bg-gray-200'
        aria-label='Zoom out'
      >
        <span class='text-lg font-semibold text-gray-700'>−</span>
      </button>
      <span class='min-w-12 text-center text-sm font-medium text-gray-700'>{zoomPercent()}%</span>
      <button
        type='button'
        onClick={handleZoomIn}
        class='flex h-8 w-8 items-center justify-center rounded hover:bg-gray-200'
        aria-label='Zoom in'
      >
        <span class='text-lg font-semibold text-gray-700'>+</span>
      </button>
    </div>
  );
}

export default function EmbedPdfViewerHeadless(props) {
  // props.pdfData - ArrayBuffer of PDF data (required)
  // props.pdfFileName - Name of the PDF file (optional, for display)

  const engineState = createPdfiumEngine({
    wasmUrl: EMBEDPDF_PDFIUM_WASM_URL || undefined,
  });

  const hasPdfData = createMemo(() => !!props.pdfData);
  const hasEngine = createMemo(() => !!engineState.engine && !engineState.isLoading);

  // Create stable document ID from filename or generate one
  const documentId = createMemo(() => {
    if (!props.pdfData) return null;
    return props.pdfFileName || `pdf-${props.pdfData.byteLength}`;
  });

  return (
    <div class='flex h-full flex-1 flex-col overflow-hidden bg-gray-100'>
      <Show
        when={hasPdfData() && hasEngine()}
        fallback={
          <div class='flex h-full items-center justify-center'>
            <div class='text-center text-gray-500'>
              <Show when={!hasPdfData()} fallback={<p>Loading PDF engine...</p>}>
                <p>No PDF selected</p>
              </Show>
            </div>
          </div>
        }
      >
        {/* Key on documentId forces clean re-initialization when document changes */}
        <Show when={documentId()} keyed>
          {docId => (
            <div class='h-full w-full'>
              <HeadlessViewerInner
                engine={engineState.engine}
                pdfData={props.pdfData}
                pdfFileName={props.pdfFileName}
                documentId={docId}
              />
            </div>
          )}
        </Show>
      </Show>
    </div>
  );
}
