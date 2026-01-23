// @ts-nocheck
import { useMemo, useRef, useState, useEffect } from 'preact/hooks';
import { EmbedPDF } from '@embedpdf/core/react';
import { usePdfiumEngine } from '@embedpdf/engines/react';
import { createPluginRegistration } from '@embedpdf/core';
import { ViewportPluginPackage, Viewport } from '@embedpdf/plugin-viewport/react';
import { ScrollPluginPackage, ScrollStrategy, Scroller } from '@embedpdf/plugin-scroll/react';
import {
  DocumentManagerPluginPackage,
  DocumentContent,
  DocumentManagerPlugin,
} from '@embedpdf/plugin-document-manager/react';
import {
  InteractionManagerPluginPackage,
  GlobalPointerProvider,
  PagePointerProvider,
} from '@embedpdf/plugin-interaction-manager/react';
import {
  ZoomMode,
  ZoomPluginPackage,
  MarqueeZoom,
  ZoomGestureWrapper,
} from '@embedpdf/plugin-zoom/react';
import { PanPluginPackage } from '@embedpdf/plugin-pan/react';
import { SpreadMode, SpreadPluginPackage } from '@embedpdf/plugin-spread/react';
import { Rotate, RotatePluginPackage } from '@embedpdf/plugin-rotate/react';
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/react';
import { TilingLayer, TilingPluginPackage } from '@embedpdf/plugin-tiling/react';
import { RedactionLayer, RedactionPluginPackage } from '@embedpdf/plugin-redaction/react';
import { ExportPluginPackage } from '@embedpdf/plugin-export/react';
import { PrintPluginPackage } from '@embedpdf/plugin-print/react';
import { SelectionLayer, SelectionPluginPackage } from '@embedpdf/plugin-selection/react';
import { SearchLayer, SearchPluginPackage } from '@embedpdf/plugin-search/react';
import { ThumbnailPluginPackage } from '@embedpdf/plugin-thumbnail/react';
import { CapturePluginPackage, MarqueeCapture } from '@embedpdf/plugin-capture/react';
import { FullscreenPluginPackage } from '@embedpdf/plugin-fullscreen/react';
import { HistoryPluginPackage } from '@embedpdf/plugin-history/react';
import { AnnotationPluginPackage, AnnotationLayer } from '@embedpdf/plugin-annotation/react';
import { ViewerToolbar, ViewMode } from './components/viewer-toolbar';
import { LoadingSpinner } from './components/loading-spinner';
import { DocumentPasswordPrompt } from './components/document-password-prompt';
import { SearchSidebar } from './components/search-sidebar';
import { ThumbnailsSidebar } from './components/thumbnails-sidebar';
import { PageControls } from './components/page-controls';
// import { ConsoleLogger } from '@embedpdf/models';
import { AnnotationSelectionMenu } from './components/annotation-selection-menu';
import { SelectionSelectionMenu } from './components/selection-selection-menu';
import { EmptyState } from './components/empty-state';
import { I18nPluginPackage } from '@embedpdf/plugin-i18n/react';
import { RedactionSelectionMenu } from './components/redaction-selection-menu';
import {
  englishTranslations,
  spanishTranslations,
  germanTranslations,
  dutchTranslations,
  paramResolvers,
} from './config';

// const logger = new ConsoleLogger();

// Type for tracking sidebar state per document
type SidebarState = {
  search: boolean;
  thumbnails: boolean;
};

type ViewerPageProps = {
  pdfData?: ArrayBuffer;
  pdfFileName?: string;
  pdfs?: Array<{ id: string; fileName: string; tag?: string }>;
  selectedPdfId?: string | null;
  onPdfSelect?: (_pdfId: string) => void;
  readOnly?: boolean;
};

export function ViewerPage({
  pdfData,
  pdfFileName,
  pdfs,
  selectedPdfId,
  onPdfSelect,
  readOnly = false,
}: ViewerPageProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { engine, isLoading, error } = usePdfiumEngine({
    // logger,
  });

  // Track sidebar state per document
  const [sidebarStates, setSidebarStates] = useState<Record<string, SidebarState>>({});

  // Track toolbar mode per document
  const [toolbarModes, setToolbarModes] = useState<Record<string, ViewMode>>({});

  // Store reference to document manager for reloading documents
  const docManagerRef = useRef<ReturnType<DocumentManagerPlugin['provides']> | null>(null);
  // Track the current active document ID to close it when switching
  const activeDocumentIdRef = useRef<string | null>(null);
  // Track the previous selectedPdfId to detect changes
  const previousSelectedPdfIdRef = useRef<string | null | undefined>(undefined);
  // Track loading state to prevent race conditions
  const isLoadingRef = useRef<boolean>(false);

  const plugins = useMemo(
    () => [
      createPluginRegistration(ViewportPluginPackage, {
        viewportGap: 10,
      }),
      createPluginRegistration(ScrollPluginPackage, {
        defaultStrategy: ScrollStrategy.Vertical,
      }),
      createPluginRegistration(DocumentManagerPluginPackage),
      createPluginRegistration(InteractionManagerPluginPackage),
      createPluginRegistration(ZoomPluginPackage, {
        defaultZoomLevel: ZoomMode.FitPage,
      }),
      createPluginRegistration(PanPluginPackage),
      createPluginRegistration(SpreadPluginPackage, {
        defaultSpreadMode: SpreadMode.None,
      }),
      createPluginRegistration(RotatePluginPackage),
      createPluginRegistration(ExportPluginPackage),
      createPluginRegistration(PrintPluginPackage),
      createPluginRegistration(RenderPluginPackage),
      createPluginRegistration(TilingPluginPackage, {
        tileSize: 768,
        overlapPx: 2.5,
        extraRings: 0,
      }),
      createPluginRegistration(SelectionPluginPackage),
      createPluginRegistration(SearchPluginPackage),
      createPluginRegistration(RedactionPluginPackage),
      createPluginRegistration(CapturePluginPackage),
      createPluginRegistration(HistoryPluginPackage),
      createPluginRegistration(AnnotationPluginPackage),
      createPluginRegistration(FullscreenPluginPackage, {
        targetElement: '#document-content',
      }),
      createPluginRegistration(ThumbnailPluginPackage, {
        width: 120,
        paddingY: 10,
      }),
      createPluginRegistration(I18nPluginPackage, {
        defaultLocale: 'en',
        fallbackLocale: 'en',
        locales: [englishTranslations, spanishTranslations, germanTranslations, dutchTranslations],
        paramResolvers,
      }),
    ],
    [], // Empty dependency array since these never change
  );

  const toggleSidebar = (documentId: string, sidebar: keyof SidebarState) => {
    setSidebarStates(prev => ({
      ...prev,
      [documentId]: {
        ...(prev[documentId] || { search: false, thumbnails: false }),
        [sidebar]: !prev[documentId]?.[sidebar],
      },
    }));
  };

  const getSidebarState = (documentId: string): SidebarState => {
    return sidebarStates[documentId] || { search: false, thumbnails: false };
  };

  const getToolbarMode = (documentId: string): ViewMode => {
    // Force 'view' mode when readOnly is true
    if (readOnly) return 'view';
    return toolbarModes[documentId] || 'view';
  };

  const setToolbarMode = (documentId: string, mode: ViewMode) => {
    // Prevent mode changes when readOnly is true
    if (readOnly) return;
    setToolbarModes(prev => ({
      ...prev,
      [documentId]: mode,
    }));
  };

  // Reload document when pdfData or selectedPdfId changes
  useEffect(() => {
    if (!docManagerRef.current || !pdfData) return;

    // Skip if selectedPdfId hasn't actually changed (initial render or same PDF)
    if (selectedPdfId === previousSelectedPdfIdRef.current) {
      return;
    }

    // Prevent multiple simultaneous loads
    if (isLoadingRef.current) {
      return;
    }

    const loadDocument = async () => {
      isLoadingRef.current = true;
      const previousPdfId = previousSelectedPdfIdRef.current;
      previousSelectedPdfIdRef.current = selectedPdfId;

      try {
        // Close the previous document if it exists and we're switching PDFs
        if (previousPdfId !== undefined && activeDocumentIdRef.current) {
          try {
            await docManagerRef.current!.closeDocument(activeDocumentIdRef.current);
          } catch (err) {
            // Ignore errors when closing (document might already be closed)
            console.warn('Error closing previous document:', err);
          }
          activeDocumentIdRef.current = null;
        }

        const selectedPdf = pdfs?.find(pdf => pdf.id === selectedPdfId) || pdfs?.[0];
        const pdfName = pdfFileName || selectedPdf?.fileName || 'document.pdf';

        // Open the new document
        // The document ID will be available via activeDocumentId in the render function
        await docManagerRef
          .current!.openDocumentBuffer({
            buffer: pdfData,
            name: pdfName,
            autoActivate: true,
          })
          .toPromise();
      } catch (err) {
        console.error('Error loading document:', err);
        // Reset the ref on error so we can retry
        previousSelectedPdfIdRef.current = previousPdfId;
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadDocument();
  }, [pdfData, selectedPdfId, pdfFileName, pdfs]);

  // Cleanup: close the active document and release resources on unmount
  useEffect(() => {
    return () => {
      const closeActiveDocument = async () => {
        if (docManagerRef.current && activeDocumentIdRef.current) {
          try {
            await docManagerRef.current.closeDocument(activeDocumentIdRef.current);
          } catch (err) {
            console.warn('Error closing document on unmount:', err);
          }
        }
        // Clear refs to release memory
        docManagerRef.current = null;
        activeDocumentIdRef.current = null;
        previousSelectedPdfIdRef.current = undefined;
        isLoadingRef.current = false;
      };
      closeActiveDocument();
    };
  }, []);

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (isLoading || !engine) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <LoadingSpinner message='Loading PDF engine...' />
      </div>
    );
  }

  return (
    <div className='flex h-screen flex-1 flex-col overflow-hidden' ref={containerRef}>
      <div className='flex flex-1 flex-col overflow-hidden select-none'>
        <EmbedPDF
          engine={engine}
          // logger={logger}
          plugins={plugins}
          onInitialized={async registry => {
            const docManager = registry
              ?.getPlugin<DocumentManagerPlugin>(DocumentManagerPlugin.id)
              ?.provides();

            if (!docManager) return;

            // Store reference for reloading documents
            docManagerRef.current = docManager;

            // Load PDF from ArrayBuffer if provided, otherwise use default URL
            // Document is automatically activated via autoActivate: true
            if (pdfData) {
              const selectedPdf = pdfs?.find(pdf => pdf.id === selectedPdfId) || pdfs?.[0];
              const pdfName = pdfFileName || selectedPdf?.fileName || 'document.pdf';
              await docManager
                .openDocumentBuffer({
                  buffer: pdfData,
                  name: pdfName,
                  autoActivate: true,
                })
                .toPromise();
            } else {
              // Fallback to default PDF URL
              await docManager
                .openDocumentUrl({ url: 'https://snippet.embedpdf.com/ebook.pdf' })
                .toPromise();
            }
          }}
        >
          {({
            pluginsReady,
            activeDocumentId,
          }: {
            pluginsReady: boolean;
            activeDocumentId: string | null;
          }) => {
            // Update the ref when activeDocumentId changes
            if (activeDocumentId !== activeDocumentIdRef.current) {
              activeDocumentIdRef.current = activeDocumentId;
            }

            return (
              <>
                {pluginsReady ?
                  <div className='flex h-full flex-col'>
                    {activeDocumentId && (
                      <ViewerToolbar
                        documentId={activeDocumentId}
                        onToggleSearch={() => toggleSidebar(activeDocumentId, 'search')}
                        onToggleThumbnails={() => toggleSidebar(activeDocumentId, 'thumbnails')}
                        isSearchOpen={getSidebarState(activeDocumentId).search}
                        isThumbnailsOpen={getSidebarState(activeDocumentId).thumbnails}
                        mode={getToolbarMode(activeDocumentId)}
                        onModeChange={mode => setToolbarMode(activeDocumentId, mode)}
                        pdfs={pdfs}
                        selectedPdfId={selectedPdfId}
                        onPdfSelect={onPdfSelect}
                        readOnly={readOnly}
                      />
                    )}

                    {/* Empty State - No Documents */}
                    {!activeDocumentId && (
                      <EmptyState
                        onDocumentOpened={() => {
                          // Document will be activated automatically via autoActivate: true
                        }}
                      />
                    )}

                    {/* Document Content Area */}
                    {activeDocumentId && (
                      <div id={activeDocumentId} className='flex flex-1 overflow-hidden bg-white'>
                        {/* Thumbnails Sidebar - Left */}
                        {getSidebarState(activeDocumentId).thumbnails && (
                          <ThumbnailsSidebar
                            documentId={activeDocumentId}
                            onClose={() => toggleSidebar(activeDocumentId, 'thumbnails')}
                          />
                        )}

                        {/* Main Viewer */}
                        <div className='flex-1 overflow-hidden'>
                          <DocumentContent documentId={activeDocumentId}>
                            {({ documentState, isLoading, isError, isLoaded }) => (
                              <>
                                {isLoading && (
                                  <div className='flex h-full items-center justify-center'>
                                    <LoadingSpinner message='Loading document...' />
                                  </div>
                                )}
                                {isError && (
                                  <DocumentPasswordPrompt documentState={documentState} />
                                )}
                                {isLoaded && (
                                  <div className='relative h-full w-full'>
                                    <GlobalPointerProvider documentId={activeDocumentId}>
                                      <Viewport
                                        className='bg-gray-100'
                                        documentId={activeDocumentId}
                                      >
                                        <ZoomGestureWrapper documentId={activeDocumentId}>
                                          <Scroller
                                            documentId={activeDocumentId}
                                            renderPage={({ pageIndex }: { pageIndex: number }) => (
                                              <Rotate
                                                documentId={activeDocumentId}
                                                pageIndex={pageIndex}
                                                style={{ backgroundColor: '#fff' }}
                                              >
                                                <PagePointerProvider
                                                  documentId={activeDocumentId}
                                                  pageIndex={pageIndex}
                                                >
                                                  <RenderLayer
                                                    documentId={activeDocumentId}
                                                    pageIndex={pageIndex}
                                                    scale={1}
                                                    style={{ pointerEvents: 'none' }}
                                                  />
                                                  <TilingLayer
                                                    documentId={activeDocumentId}
                                                    pageIndex={pageIndex}
                                                    style={{ pointerEvents: 'none' }}
                                                  />
                                                  <SearchLayer
                                                    documentId={activeDocumentId}
                                                    pageIndex={pageIndex}
                                                  />
                                                  <MarqueeZoom
                                                    documentId={activeDocumentId}
                                                    pageIndex={pageIndex}
                                                  />
                                                  <MarqueeCapture
                                                    documentId={activeDocumentId}
                                                    pageIndex={pageIndex}
                                                  />
                                                  <SelectionLayer
                                                    documentId={activeDocumentId}
                                                    pageIndex={pageIndex}
                                                    selectionMenu={props => (
                                                      <SelectionSelectionMenu
                                                        {...props}
                                                        documentId={activeDocumentId}
                                                      />
                                                    )}
                                                  />
                                                  <RedactionLayer
                                                    documentId={activeDocumentId}
                                                    pageIndex={pageIndex}
                                                    selectionMenu={props => (
                                                      <RedactionSelectionMenu
                                                        {...props}
                                                        documentId={activeDocumentId}
                                                      />
                                                    )}
                                                  />
                                                  <AnnotationLayer
                                                    documentId={activeDocumentId}
                                                    pageIndex={pageIndex}
                                                    selectionMenu={props => (
                                                      <AnnotationSelectionMenu
                                                        {...props}
                                                        documentId={activeDocumentId}
                                                      />
                                                    )}
                                                  />
                                                </PagePointerProvider>
                                              </Rotate>
                                            )}
                                          />
                                        </ZoomGestureWrapper>
                                        {/* Page Controls */}
                                        <PageControls documentId={activeDocumentId} />
                                      </Viewport>
                                    </GlobalPointerProvider>
                                  </div>
                                )}
                              </>
                            )}
                          </DocumentContent>
                        </div>

                        {/* Search Sidebar - Right */}
                        {getSidebarState(activeDocumentId).search && (
                          <SearchSidebar
                            documentId={activeDocumentId}
                            onClose={() => toggleSidebar(activeDocumentId, 'search')}
                          />
                        )}
                      </div>
                    )}
                  </div>
                : <div className='flex h-full items-center justify-center'>
                    <LoadingSpinner message='Initializing plugins...' />
                  </div>
                }
              </>
            );
          }}
        </EmbedPDF>
      </div>
    </div>
  );
}
