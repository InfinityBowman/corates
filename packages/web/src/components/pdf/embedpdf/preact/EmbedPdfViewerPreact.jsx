/**
 * EmbedPdfViewerPreact - Preact component using EmbedPDF headless mode
 * Implements custom UI using EmbedPDF's headless components and plugins
 */

import { usePdfiumEngine } from '@embedpdf/engines/preact';
import { EmbedPDF } from '@embedpdf/core/preact';
import { createPluginRegistration } from '@embedpdf/core';
import { ViewportPluginPackage, Viewport } from '@embedpdf/plugin-viewport/preact';
import { Scroller, ScrollPluginPackage } from '@embedpdf/plugin-scroll/preact';
import {
  DocumentManagerPluginPackage,
  DocumentContent,
  DocumentManagerPlugin,
} from '@embedpdf/plugin-document-manager/preact';
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/preact';
import { ZoomPluginPackage } from '@embedpdf/plugin-zoom/preact';
import {
  InteractionManagerPluginPackage,
  GlobalPointerProvider,
  PagePointerProvider,
} from '@embedpdf/plugin-interaction-manager/preact';
import { PanPluginPackage } from '@embedpdf/plugin-pan/preact';
import { SpreadPluginPackage } from '@embedpdf/plugin-spread/preact';
import { Rotate, RotatePluginPackage } from '@embedpdf/plugin-rotate/preact';
import { TilingLayer, TilingPluginPackage } from '@embedpdf/plugin-tiling/preact';
import { SelectionLayer, SelectionPluginPackage } from '@embedpdf/plugin-selection/preact';
import { SearchLayer, SearchPluginPackage } from '@embedpdf/plugin-search/preact';
import { ThumbnailPluginPackage } from '@embedpdf/plugin-thumbnail/preact';
import { CapturePluginPackage } from '@embedpdf/plugin-capture/preact';
import { FullscreenPluginPackage } from '@embedpdf/plugin-fullscreen/preact';
import { HistoryPluginPackage } from '@embedpdf/plugin-history/preact';
import { AnnotationLayer, AnnotationPluginPackage } from '@embedpdf/plugin-annotation/preact';
import { useEffect, useMemo, useRef, useState, useCallback } from 'preact/hooks';

import { ViewerToolbar } from './components/toolbar/index.js';
import { SearchSidebar, ThumbnailsSidebar } from './components/sidebars/index.js';
import PageControls from './components/PageControls.jsx';
import { LoadingSpinner } from './components/ui/index.js';

/**
 * EmbedPdfViewerPreact - Preact component for viewing PDFs with EmbedPDF headless mode
 * @param {Object} props - Component props
 * @param {ArrayBuffer} props.pdfData - ArrayBuffer of PDF data (required)
 * @param {string} props.pdfFileName - Name of the PDF file (optional)
 * @param {boolean} props.readOnly - If true, view only mode
 * @param {Array} props.pdfs - Array of PDFs for multi-PDF selection
 * @param {string} props.selectedPdfId - Currently selected PDF ID
 * @param {Function} props.onPdfSelect - Handler for PDF selection change
 */
export default function EmbedPdfViewerPreact(props) {
  const { readOnly = false } = props;

  // Sidebar state
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Initialize the PDF engine
  const pdfEngine = usePdfiumEngine();

  // Keep plugins stable - don't recreate on prop changes
  // Core plugins always registered, annotation plugins only if not readOnly
  const plugins = useMemo(
    () => {
      const corePlugins = [
        createPluginRegistration(DocumentManagerPluginPackage),
        createPluginRegistration(ViewportPluginPackage),
        createPluginRegistration(ScrollPluginPackage),
        createPluginRegistration(RenderPluginPackage),
        createPluginRegistration(ZoomPluginPackage, {
          defaultZoomMode: 'FitWidth',
        }),
        createPluginRegistration(InteractionManagerPluginPackage),
        createPluginRegistration(PanPluginPackage),
        createPluginRegistration(SpreadPluginPackage),
        createPluginRegistration(RotatePluginPackage),
        createPluginRegistration(TilingPluginPackage),
        createPluginRegistration(SelectionPluginPackage),
        createPluginRegistration(SearchPluginPackage),
        createPluginRegistration(ThumbnailPluginPackage, {
          thumbnailWidth: 120,
        }),
        createPluginRegistration(CapturePluginPackage),
        createPluginRegistration(FullscreenPluginPackage),
        createPluginRegistration(HistoryPluginPackage),
      ];

      // Only add annotation plugin if not in read-only mode
      if (!readOnly) {
        corePlugins.push(createPluginRegistration(AnnotationPluginPackage));
      }

      return corePlugins;
    },
    [readOnly], // Only recreate if readOnly changes
  );

  // Track loaded document ID and registry
  const loadedDocumentIdRef = useRef(null);
  const loadingRef = useRef(false);
  const registryRef = useRef(null);

  // Toggle handlers
  const handleToggleThumbnails = useCallback(() => {
    setShowThumbnails(prev => !prev);
    if (showSearch) setShowSearch(false);
  }, [showSearch]);

  const handleToggleSearch = useCallback(() => {
    setShowSearch(prev => !prev);
    if (showThumbnails) setShowThumbnails(false);
  }, [showThumbnails]);

  // Function to load document
  const loadDocument = (registry, pdfData, pdfFileName, documentId) => {
    if (!registry || !pdfData || loadingRef.current) return;

    const documentManager = registry?.getPlugin(DocumentManagerPlugin.id)?.provides();

    if (!documentManager) return;

    // Check if we've already loaded this document
    const currentDocId = loadedDocumentIdRef.current;
    if (currentDocId && documentManager.getDocument(currentDocId)) {
      documentManager.setActiveDocument(currentDocId);
      return;
    }

    loadingRef.current = true;
    const docId = documentId || `doc-${Date.now()}`;

    documentManager
      .openDocumentBuffer({
        buffer: pdfData,
        name: pdfFileName || 'document.pdf',
        documentId: docId,
        autoActivate: true,
      })
      .wait(
        result => {
          loadedDocumentIdRef.current = result.documentId;
          loadingRef.current = false;
        },
        error => {
          console.error('Failed to load document:', error);
          loadingRef.current = false;
        },
      );
  };

  // Load document when props change
  useEffect(() => {
    if (registryRef.current && props.pdfData) {
      loadDocument(registryRef.current, props.pdfData, props.pdfFileName, props.selectedPdfId);
    }
  }, [props.pdfData, props.pdfFileName, props.selectedPdfId]);

  // Loading state
  if (pdfEngine.isLoading || !pdfEngine.engine) {
    return (
      <div class='flex h-full items-center justify-center bg-gray-100'>
        <LoadingSpinner message='Loading PDF Engine...' />
      </div>
    );
  }

  // Error state
  if (pdfEngine.error) {
    return (
      <div class='flex h-full items-center justify-center bg-gray-100'>
        <div class='text-center text-gray-500'>
          <p class='text-sm'>Failed to load PDF engine</p>
          <p class='mt-1 text-xs'>{pdfEngine.error.message}</p>
        </div>
      </div>
    );
  }

  // No PDF data
  if (!props.pdfData) {
    return (
      <div class='flex h-full items-center justify-center bg-gray-100'>
        <div class='text-center text-gray-500'>
          <p class='text-sm'>No PDF selected</p>
        </div>
      </div>
    );
  }

  // Main viewer
  return (
    <div class='flex h-full w-full flex-col bg-gray-100'>
      <EmbedPDF
        engine={pdfEngine.engine}
        plugins={plugins}
        onInitialized={registry => {
          registryRef.current = registry;
          if (props.pdfData) {
            loadDocument(registry, props.pdfData, props.pdfFileName, props.selectedPdfId);
          }
        }}
      >
        {({ pluginsReady, activeDocumentId }) => {
          if (!pluginsReady) {
            return (
              <div class='flex h-full items-center justify-center'>
                <LoadingSpinner message='Initializing plugins...' />
              </div>
            );
          }

          if (!activeDocumentId) {
            return (
              <div class='flex h-full items-center justify-center'>
                <div class='text-center text-gray-500'>
                  <p class='text-sm'>No document loaded</p>
                </div>
              </div>
            );
          }

          return (
            <DocumentContent documentId={activeDocumentId}>
              {({ documentState, isLoading, isError, isLoaded }) => {
                if (isLoading) {
                  return (
                    <div class='flex h-full items-center justify-center bg-gray-200'>
                      <LoadingSpinner message='Loading document...' />
                    </div>
                  );
                }

                if (isError) {
                  return (
                    <div class='flex h-full items-center justify-center bg-gray-200'>
                      <div class='text-center text-gray-500'>
                        <p class='text-sm'>Failed to load document</p>
                        {documentState?.error && (
                          <p class='mt-1 text-xs'>{documentState.error.message}</p>
                        )}
                      </div>
                    </div>
                  );
                }

                if (!isLoaded) {
                  return (
                    <div class='flex h-full items-center justify-center bg-gray-200'>
                      <div class='text-center text-gray-500'>
                        <p class='text-sm'>Document not loaded</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div class='flex h-full flex-col'>
                    {/* Toolbar */}
                    <ViewerToolbar
                      documentId={activeDocumentId}
                      onToggleThumbnails={handleToggleThumbnails}
                      onToggleSearch={handleToggleSearch}
                      showThumbnails={showThumbnails}
                      showSearch={showSearch}
                      readOnly={readOnly}
                    />

                    {/* Main content area with sidebars */}
                    <div class='flex flex-1 overflow-hidden'>
                      {/* Thumbnails sidebar */}
                      {showThumbnails && (
                        <ThumbnailsSidebar
                          documentId={activeDocumentId}
                          onClose={() => setShowThumbnails(false)}
                        />
                      )}

                      {/* Search sidebar */}
                      {showSearch && (
                        <SearchSidebar
                          documentId={activeDocumentId}
                          onClose={() => setShowSearch(false)}
                        />
                      )}

                      {/* PDF viewport */}
                      <div class='relative flex-1'>
                        <Viewport documentId={activeDocumentId} class='h-full bg-gray-200'>
                          <Scroller
                            documentId={activeDocumentId}
                            renderPage={({ pageIndex }) => (
                              <Rotate documentId={activeDocumentId} pageIndex={pageIndex}>
                                <GlobalPointerProvider>
                                  <PagePointerProvider
                                    documentId={activeDocumentId}
                                    pageIndex={pageIndex}
                                  >
                                    <div
                                      style={{
                                        position: 'relative',
                                        backgroundColor: '#fff',
                                      }}
                                    >
                                      {/* Render layer for page content */}
                                      <TilingLayer
                                        documentId={activeDocumentId}
                                        pageIndex={pageIndex}
                                      >
                                        <RenderLayer
                                          documentId={activeDocumentId}
                                          pageIndex={pageIndex}
                                          scale={1}
                                          style={{ pointerEvents: 'none' }}
                                        />
                                      </TilingLayer>

                                      {/* Text selection layer */}
                                      <SelectionLayer
                                        documentId={activeDocumentId}
                                        pageIndex={pageIndex}
                                      />

                                      {/* Search highlighting layer */}
                                      <SearchLayer
                                        documentId={activeDocumentId}
                                        pageIndex={pageIndex}
                                      />

                                      {/* Annotation layer (only if not readOnly) */}
                                      {!readOnly && (
                                        <AnnotationLayer
                                          documentId={activeDocumentId}
                                          pageIndex={pageIndex}
                                        />
                                      )}
                                    </div>
                                  </PagePointerProvider>
                                </GlobalPointerProvider>
                              </Rotate>
                            )}
                          />
                        </Viewport>

                        {/* Floating page controls */}
                        <PageControls documentId={activeDocumentId} />
                      </div>
                    </div>
                  </div>
                );
              }}
            </DocumentContent>
          );
        }}
      </EmbedPDF>
    </div>
  );
}
