import { useMemo, useRef, useState, useEffect } from 'react';
import { EmbedPDF } from '@embedpdf/core/react';
import { usePdfiumEngine } from '@embedpdf/engines/react';
import { PDFIUM_WASM_URL } from '@/lib/pdfiumWasmUrl';
import { captureException } from '@/config/sentry';
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
  useZoom,
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
import {
  AnnotationPluginPackage,
  AnnotationLayer,
  useAnnotationCapability,
} from '@embedpdf/plugin-annotation/react';
import { ViewerToolbar, ViewMode } from './components/viewer-toolbar';
import { drainLoads, type DocumentLoader } from './document-loader';
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

/**
 * AnnotationSyncManager - Invisible component that handles annotation persistence
 * Must be rendered inside EmbedPDF context to access annotation plugin
 */
function AnnotationSyncManager({
  documentId,
  pdfId,
  readOnly,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  initialAnnotations,
}: {
  documentId: string;
  pdfId?: string | null;
  readOnly: boolean;
  onAnnotationAdd?: (_annotation: any) => void;
  onAnnotationUpdate?: (_annotation: any) => void;
  onAnnotationDelete?: (_annotationId: string) => void;
  initialAnnotations?: AnnotationData[];
}) {
  const { provides: annotationCapability } = useAnnotationCapability();
  const isApplyingRef = useRef(false);
  // Track loaded annotation IDs to prevent duplicates
  const loadedAnnotationIdsRef = useRef<Set<string>>(new Set());
  // Track all known annotations (both loaded and user-created)
  const annotationMapRef = useRef<Map<string, any>>(new Map());

  // Get document-scoped annotation API
  const annotationScope = useMemo(
    () => (annotationCapability ? annotationCapability.forDocument(documentId) : null),
    [annotationCapability, documentId],
  );

  // Reset state when documentId or pdfId changes
  useEffect(() => {
    loadedAnnotationIdsRef.current.clear();
    annotationMapRef.current.clear();
  }, [documentId, pdfId]);

  // Load initial annotations using importAnnotations (for persisted data)
  useEffect(() => {
    console.log('[AnnotationSync] Load effect triggered:', {
      hasAnnotationScope: !!annotationScope,
      initialAnnotationsCount: initialAnnotations?.length || 0,
      initialAnnotations,
    });

    if (!annotationScope || !initialAnnotations?.length) {
      return;
    }

    // Filter to only annotations we haven't loaded yet
    const annotationsToLoad = initialAnnotations.filter(annotation => {
      if (!annotation.embedPdfData) {
        console.log('[AnnotationSync] Skipping annotation without embedPdfData:', annotation);
        return false;
      }
      const annotationId = annotation.id || annotation.embedPdfData.id;
      const alreadyLoaded = loadedAnnotationIdsRef.current.has(annotationId);
      console.log('[AnnotationSync] Annotation:', annotationId, 'alreadyLoaded:', alreadyLoaded);
      return annotationId && !alreadyLoaded;
    });

    console.log('[AnnotationSync] Annotations to load:', annotationsToLoad.length);

    if (!annotationsToLoad.length) return;

    isApplyingRef.current = true;
    let cancelled = false;

    // Build import items for importAnnotations API
    const importItems = annotationsToLoad.map(annotation => {
      const embedData = annotation.embedPdfData;
      const annotationId = annotation.id || embedData.id;

      // Mark as loaded before importing to prevent duplicates
      loadedAnnotationIdsRef.current.add(annotationId);
      annotationMapRef.current.set(annotationId, annotation);

      console.log('[AnnotationSync] Preparing import for:', annotationId, 'embedData:', embedData);

      return {
        annotation: {
          ...embedData,
          id: annotationId,
        },
      };
    });

    // Wrap in async to properly guard isApplyingRef if importAnnotations is async
    (async () => {
      try {
        console.log('[AnnotationSync] Calling importAnnotations with', importItems.length, 'items');
        await annotationScope.importAnnotations(importItems);
        console.log('[AnnotationSync] importAnnotations completed');
      } catch (err) {
        console.error('[AnnotationSync] Failed to import annotations:', err);
        captureException(err, {
          component: 'EmbedPdfViewer',
          action: 'importAnnotations',
          count: importItems.length,
        });
      } finally {
        if (!cancelled) {
          isApplyingRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
      isApplyingRef.current = false;
    };
  }, [annotationScope, initialAnnotations]);

  // Subscribe to annotation changes using the unified onAnnotationEvent hook
  useEffect(() => {
    if (!annotationScope || readOnly) return;

    console.log('[AnnotationSync] Setting up subscription to onAnnotationEvent');

    // Subscribe to all annotation events via the single event hook
    const unsub = annotationScope.onAnnotationEvent?.((event: any) => {
      console.log('[AnnotationSync] onAnnotationEvent fired:', event);

      // Skip events while we're applying loaded annotations
      if (isApplyingRef.current) {
        console.log('[AnnotationSync] Skipping - isApplyingRef is true');
        return;
      }

      const annotation = event.annotation;
      const annotationId = annotation?.id;

      if (!annotation || !annotationId) {
        console.warn('[AnnotationSync] Event missing annotation or id, skipping:', event.type);
        return;
      }

      switch (event.type) {
        case 'create': {
          // Skip if this annotation was loaded from storage (already tracked)
          if (annotationMapRef.current.has(annotationId)) {
            console.log('[AnnotationSync] Skipping create - already tracked:', annotationId);
            return;
          }

          annotationMapRef.current.set(annotationId, annotation);
          console.log('[AnnotationSync] Calling onAnnotationAdd for:', annotationId);

          if (onAnnotationAdd) {
            onAnnotationAdd({
              id: annotationId,
              type: annotation.type,
              pageIndex: event.pageIndex,
              ...annotation,
            });
          }
          break;
        }
        case 'update': {
          annotationMapRef.current.set(annotationId, annotation);
          console.log('[AnnotationSync] Calling onAnnotationUpdate for:', annotationId);

          if (onAnnotationUpdate) {
            onAnnotationUpdate({
              id: annotationId,
              type: annotation.type,
              pageIndex: event.pageIndex,
              ...annotation,
            });
          }
          break;
        }
        case 'delete': {
          annotationMapRef.current.delete(annotationId);
          console.log('[AnnotationSync] Calling onAnnotationDelete for:', annotationId);

          if (onAnnotationDelete) {
            onAnnotationDelete(annotationId);
          }
          break;
        }
        case 'loaded': {
          // Initial load event - we handle this separately
          console.log('[AnnotationSync] Annotations loaded event, total:', event.total);
          break;
        }
      }
    });

    return () => {
      unsub?.();
    };
  }, [annotationScope, readOnly, onAnnotationAdd, onAnnotationUpdate, onAnnotationDelete]);

  // This component doesn't render anything
  return null;
}

// Type for tracking sidebar state per document
type SidebarState = {
  search: boolean;
  thumbnails: boolean;
};

type AnnotationData = {
  id: string;
  type: string;
  pageIndex: number;
  embedPdfData: any;
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
};

type ViewerPageProps = {
  pdfData?: ArrayBuffer;
  pdfFileName?: string;
  pdfs?: Array<{ id: string; fileName: string; tag?: string }>;
  selectedPdfId?: string | null;
  onPdfSelect?: (_pdfId: string) => void;
  readOnly?: boolean;
  initialZoom?: number;
  // Annotation persistence props
  onAnnotationAdd?: (_annotation: any) => void;
  onAnnotationUpdate?: (_annotation: any) => void;
  onAnnotationDelete?: (_annotationId: string) => void;
  initialAnnotations?: AnnotationData[];
};

// plugin-zoom 2.15 never releases its render gate for a numeric default level (corates#821),
// so start on fit-page and request the number after the plugin's first zoom pass
function InitialZoom({ documentId, level }: { documentId: string; level: number }) {
  const { provides } = useZoom(documentId);
  // useZoom returns a new scope each render; without this guard every later zoom change snaps back
  const appliedTo = useRef<string | null>(null);
  useEffect(() => {
    if (!provides || appliedTo.current === documentId) return;
    const off = provides.onZoomChange(evt => {
      if (evt.documentId !== documentId) return;
      appliedTo.current = documentId;
      off();
      // Anchor the top-left corner so the document still starts at its top
      if (evt.level !== level) provides.requestZoom(level, { vx: 0, vy: 0 });
    });
    return off;
  }, [documentId, provides, level]);
  return null;
}

export function ViewerPage({
  pdfData,
  pdfFileName,
  pdfs,
  selectedPdfId,
  onPdfSelect,
  readOnly = false,
  initialZoom,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  initialAnnotations,
}: ViewerPageProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { engine, isLoading, error } = usePdfiumEngine({
    wasmUrl: PDFIUM_WASM_URL,
  });

  // Track sidebar state per document
  const [sidebarStates, setSidebarStates] = useState<Record<string, SidebarState>>({});

  // Track toolbar mode per document
  const [toolbarModes, setToolbarModes] = useState<Record<string, ViewMode>>({});

  const loaderRef = useRef<DocumentLoader>({
    docManager: null,
    activeDocumentId: null,
    loadedPdfId: undefined,
    pending: null,
    loading: false,
  });

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
      createPluginRegistration(AnnotationPluginPackage, {
        // Disable auto-commit since we persist annotations to Y.js, not the PDF file
        autoCommit: false,
      }),
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

  // Reload when the selected document changes; a data-only change keeps the open one
  useEffect(() => {
    const loader = loaderRef.current;
    if (!pdfData || selectedPdfId === loader.loadedPdfId) return;
    loader.pending = { pdfData, selectedPdfId, pdfFileName, pdfs };
    if (loader.docManager) void drainLoads(loader);
  }, [pdfData, selectedPdfId, pdfFileName, pdfs]);

  // The engine hook closes every document on unmount; only drop our handles
  useEffect(() => {
    const loader = loaderRef.current;
    return () => {
      loader.docManager = null;
      loader.activeDocumentId = null;
      loader.loadedPdfId = undefined;
      loader.pending = null;
      loader.loading = false;
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

            const loader = loaderRef.current;
            loader.docManager = docManager;

            if (pdfData) {
              // The reload effect may already have queued a newer request while the engine started
              loader.pending ??= { pdfData, selectedPdfId, pdfFileName, pdfs };
              await drainLoads(loader);
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
            // Keep the loader's handle in step with the registry
            if (activeDocumentId !== loaderRef.current.activeDocumentId) {
              loaderRef.current.activeDocumentId = activeDocumentId;
            }

            return (
              <>
                {activeDocumentId && initialZoom !== undefined && (
                  <InitialZoom documentId={activeDocumentId} level={initialZoom} />
                )}
                {/* Annotation sync manager - handles persistence */}
                {activeDocumentId &&
                  (onAnnotationAdd ||
                    onAnnotationUpdate ||
                    onAnnotationDelete ||
                    initialAnnotations) && (
                    <AnnotationSyncManager
                      documentId={activeDocumentId}
                      pdfId={selectedPdfId}
                      readOnly={readOnly}
                      onAnnotationAdd={onAnnotationAdd}
                      onAnnotationUpdate={onAnnotationUpdate}
                      onAnnotationDelete={onAnnotationDelete}
                      initialAnnotations={initialAnnotations}
                    />
                  )}
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
