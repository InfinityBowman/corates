/**
 * EmbedPdfViewer - Component for viewing PDF files using EmbedPDF
 * This is a minimal implementation for view-only interaction (scroll/zoom/page nav)
 */

import {
  Switch,
  Match,
  createMemo,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  untrack,
} from 'solid-js';
import { EmbedPDF, createPdfiumEngine, viewport, scroll, render } from '@corates/embedpdf-solid';
import { createPluginRegistration } from '@embedpdf/core';
import { DocumentManagerPluginPackage } from '@embedpdf/plugin-document-manager';
import { ViewportPluginPackage } from '@embedpdf/plugin-viewport';
import { ScrollPluginPackage } from '@embedpdf/plugin-scroll';
import { RenderPluginPackage } from '@embedpdf/plugin-render';
import { EMBEDPDF_PDFIUM_WASM_URL } from '@config/pdfViewer.js';

const DEFAULT_PDFIUM_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@2.1.1/dist/pdfium.wasm';

function getEmbedPdfDebugEnabled() {
  if (import.meta.env?.VITE_EMBEDPDF_DEBUG === '1') return true;
  if (typeof window === 'undefined') return false;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('embedpdfDebug') || params.get('embedpdfDebug') === '1') return true;
    if (window.localStorage?.getItem('embedpdf:debug') === '1') return true;
  } catch {
    // ignore
  }

  return false;
}

function getEmbedPdfDebugFlag(name) {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has(name) || params.get(name) === '1';
  } catch {
    return false;
  }
}

function createEmbedPdfConsoleLogger(enabled) {
  if (!enabled) return undefined;

  const prefix = '[embedpdf]';
  return {
    debug: (...args) => console.debug(prefix, ...args),
    info: (...args) => console.info(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
    log: (...args) => console.log(prefix, ...args),
  };
}

async function probeFetch(url, options) {
  const startedAt = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 4000);

    const res = await fetch(url, {
      method: options?.method ?? 'GET',
      headers: options?.headers,
      credentials: options?.credentials ?? 'include',
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeout);

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get('content-type'),
      contentLength: res.headers.get('content-length'),
      durationMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      statusText: null,
      contentType: null,
      contentLength: null,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function truncateUrl(url, max = 90) {
  if (!url) return '';
  if (url.length <= max) return url;
  return `${url.slice(0, Math.max(0, max - 3))}...`;
}

function prettyBool(value) {
  return value ? 'yes' : 'no';
}

function EmbedPdfInternalDebug(props) {
  const viewportCap = viewport.useViewportCapability();
  const scrollCap = scroll.useScrollCapability();
  const renderCap = render.useRenderCapability();
  const isViewportGated = viewport.useIsViewportGated(() => props.documentId);
  const scrollState = scroll.useScroll(() => props.documentId);
  const renderState = render.useRender(() => props.documentId);

  const hasViewportCapability = createMemo(() => !!viewportCap.provides);
  const hasScrollCapability = createMemo(() => !!scrollCap.provides);
  const hasRenderCapability = createMemo(() => !!renderCap.provides);
  const hasScopedScroll = createMemo(() => !!scrollState.provides);
  const hasScopedRender = createMemo(() => !!renderState.provides);

  return (
    <div class='pointer-events-auto rounded border border-gray-200 bg-white/95 p-2 text-xs text-gray-800 shadow-sm'>
      <div class='mb-1 font-semibold'>EmbedPDF internal</div>
      <div class='grid grid-cols-2 gap-x-3 gap-y-1'>
        <div class='text-gray-500'>pluginsReady</div>
        <div>{prettyBool(!!props.embedState?.pluginsReady)}</div>

        <div class='text-gray-500'>isInitializing</div>
        <div>{prettyBool(!!props.embedState?.isInitializing)}</div>

        <div class='text-gray-500'>documentId</div>
        <div class='font-mono'>{props.documentId || '(none)'}</div>

        <div class='text-gray-500'>viewportCapability</div>
        <div>{prettyBool(hasViewportCapability())}</div>

        <div class='text-gray-500'>viewportGated</div>
        <div>{prettyBool(isViewportGated())}</div>

        <div class='text-gray-500'>scrollCapability</div>
        <div>{prettyBool(hasScrollCapability())}</div>

        <div class='text-gray-500'>scrollScopeForDoc</div>
        <div>{prettyBool(hasScopedScroll())}</div>

        <div class='text-gray-500'>renderCapability</div>
        <div>{prettyBool(hasRenderCapability())}</div>

        <div class='text-gray-500'>renderScopeForDoc</div>
        <div>{prettyBool(hasScopedRender())}</div>
      </div>

      <div class='mt-2'>
        <div class='text-gray-500'>scrollState</div>
        <div class='font-mono'>
          page {scrollState.state.currentPage} / {scrollState.state.totalPages}
        </div>

        <div class='text-gray-500'>documentState.status</div>
        <div class='font-mono'>{props.documentState?.status ?? '(missing)'}</div>

        <div class='mt-1 text-gray-500'>documentState.error</div>
        <div class='font-mono'>
          {props.documentState?.error?.message || props.documentState?.error || '(none)'}
        </div>
      </div>
    </div>
  );
}

export default function EmbedPdfViewer(props) {
  // props.pdfUrl - URL to the PDF (org-scoped, optional)
  // props.pdfData - ArrayBuffer of PDF data (optional, preferred for cross-origin)
  // props.pdfFileName - Name of the PDF file (optional, used with pdfData)
  // props.readOnly - If true, hides upload/change/clear buttons (view only mode)

  const debugEnabled = createMemo(() => !!props.debug || getEmbedPdfDebugEnabled());
  const logger = createMemo(() => createEmbedPdfConsoleLogger(debugEnabled()));
  const noAutoMount = createMemo(
    () => debugEnabled() && getEmbedPdfDebugFlag('embedpdfNoAutoMount'),
  );

  const wasmUrl = createMemo(() => EMBEDPDF_PDFIUM_WASM_URL || DEFAULT_PDFIUM_WASM_URL);

  const engineState = createPdfiumEngine(
    untrack(() => ({
      wasmUrl: wasmUrl(),
      logger: logger(),
    })),
  );

  // Create blob URL synchronously from pdfData
  const blobUrl = createMemo(() => {
    const pdfData = props.pdfData;
    if (!pdfData) return null;

    const blob = new Blob([pdfData], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  });

  // Track previous blob URL and clean it up when pdfData changes
  let previousBlobUrl = null;
  createEffect(() => {
    const currentUrl = blobUrl();

    // Revoke previous URL if it exists and is different from current
    if (previousBlobUrl && previousBlobUrl !== currentUrl) {
      URL.revokeObjectURL(previousBlobUrl);
    }

    previousBlobUrl = currentUrl;
  });

  // Clean up blob URL on unmount
  onCleanup(() => {
    const url = blobUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  });

  // Determine which URL to use: blob URL (from pdfData) or pdfUrl
  const documentUrl = createMemo(() => {
    const blob = blobUrl();
    if (blob) return blob;
    return props.pdfUrl || null;
  });

  const [containerSize, setContainerSize] = createSignal({ width: 0, height: 0 });
  const [docFetchProbe, setDocFetchProbe] = createSignal({ state: 'idle' });
  const [wasmFetchProbe, setWasmFetchProbe] = createSignal({ state: 'idle' });
  const [lastGlobalError, setLastGlobalError] = createSignal(null);
  let containerRef;

  onMount(() => {
    if (!containerRef || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ width: Math.round(width), height: Math.round(height) });
    });

    ro.observe(containerRef);
    onCleanup(() => ro.disconnect());
  });

  createEffect(() => {
    if (!debugEnabled()) return;
    const url = documentUrl();
    const hasPdfData = !!props.pdfData;
    logger()?.info('viewer inputs', {
      hasPdfData,
      pdfDataBytes: hasPdfData ? props.pdfData.byteLength : 0,
      pdfUrl: props.pdfUrl || null,
      resolvedDocumentUrl: url,
      wasmUrl: wasmUrl(),
    });
  });

  createEffect(() => {
    if (!debugEnabled()) return;
    logger()?.info('engine state', {
      isLoading: engineState.isLoading,
      hasEngine: !!engineState.engine,
      error: engineState.error?.message || null,
    });
  });

  createEffect(() => {
    if (!debugEnabled()) return;

    const handler = event => {
      try {
        const message =
          event?.reason?.message ||
          event?.error?.message ||
          event?.message ||
          (typeof event?.reason === 'string' ? event.reason : null) ||
          null;
        setLastGlobalError(message);
        logger()?.error('global error', event);
      } catch {
        // ignore
      }
    };

    window.addEventListener('error', handler);
    window.addEventListener('unhandledrejection', handler);
    onCleanup(() => {
      window.removeEventListener('error', handler);
      window.removeEventListener('unhandledrejection', handler);
    });
  });

  createEffect(() => {
    if (!debugEnabled()) return;

    const url = documentUrl();
    if (!url) {
      setDocFetchProbe({ state: 'idle' });
      return;
    }

    setDocFetchProbe({ state: 'probing' });
    const log = logger();
    const isRemote = /^https?:\/\//i.test(url);
    const probePromise = probeFetch(url, {
      method: 'GET',
      headers: isRemote ? { Range: 'bytes=0-0' } : undefined,
      credentials: 'include',
      timeoutMs: 5000,
    }).then(result => {
      setDocFetchProbe({ state: 'done', url, result });
      log?.info('document fetch probe', { url, ...result });
    });

    void probePromise;
  });

  createEffect(() => {
    if (!debugEnabled()) return;

    const url = wasmUrl();
    if (!url) {
      setWasmFetchProbe({ state: 'idle' });
      return;
    }

    setWasmFetchProbe({ state: 'probing' });
    const log = logger();
    const probePromise = probeFetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      credentials: 'omit',
      timeoutMs: 5000,
    }).then(result => {
      setWasmFetchProbe({ state: 'done', url, result });
      log?.info('wasm fetch probe', { url, ...result });
    });

    void probePromise;
  });

  const plugins = createMemo(() => {
    const url = documentUrl();
    if (!url) return [];
    return [
      createPluginRegistration(DocumentManagerPluginPackage, {
        initialDocuments: [{ url }],
      }),
      createPluginRegistration(ViewportPluginPackage),
      createPluginRegistration(ScrollPluginPackage),
      createPluginRegistration(RenderPluginPackage),
    ];
  });

  // State machine: loading | error | no-pdf | ready
  const viewState = createMemo(() => {
    if (engineState.isLoading) return 'loading';
    if (engineState.error) return 'error';
    if (!documentUrl()) return 'no-pdf';
    if (engineState.engine) return 'ready';
    return 'loading';
  });

  // Only render EmbedPDF when we have both engine and a valid document URL
  // This ensures plugins are initialized with the correct URL
  const canRenderEmbedPDF = createMemo(() => {
    return engineState.engine && documentUrl() && plugins().length > 0;
  });

  return (
    <div ref={containerRef} class='relative flex h-full flex-1 flex-col bg-gray-100'>
      {debugEnabled() && (
        <div class='pointer-events-none absolute top-2 left-2 z-10 max-w-[560px] space-y-2'>
          <div class='pointer-events-auto rounded border border-gray-200 bg-white/95 p-2 text-xs text-gray-800 shadow-sm'>
            <div class='mb-1 flex items-center justify-between'>
              <div class='font-semibold'>EmbedPDF debug</div>
              <div class='text-gray-500'>
                url param: <span class='font-mono'>embedpdfDebug=1</span>
              </div>
            </div>

            <div class='grid grid-cols-2 gap-x-3 gap-y-1'>
              <div class='text-gray-500'>viewState</div>
              <div class='font-mono'>{viewState()}</div>

              <div class='text-gray-500'>canRenderEmbedPDF</div>
              <div>{prettyBool(!!canRenderEmbedPDF())}</div>

              <div class='text-gray-500'>autoMountDomElements</div>
              <div>{noAutoMount() ? 'no (forced off)' : 'yes (default)'}</div>

              <div class='text-gray-500'>container</div>
              <div class='font-mono'>
                {containerSize().width}x{containerSize().height}
              </div>

              <div class='text-gray-500'>pdfData bytes</div>
              <div class='font-mono'>{props.pdfData ? props.pdfData.byteLength : 0}</div>

              <div class='text-gray-500'>pdfUrl</div>
              <div class='font-mono'>{truncateUrl(props.pdfUrl || '(none)')}</div>

              <div class='text-gray-500'>documentUrl</div>
              <div class='font-mono'>{truncateUrl(documentUrl() || '(none)')}</div>

              <div class='text-gray-500'>wasmUrl</div>
              <div class='font-mono'>{truncateUrl(wasmUrl())}</div>

              <div class='text-gray-500'>engineLoading</div>
              <div>{prettyBool(engineState.isLoading)}</div>

              <div class='text-gray-500'>engineError</div>
              <div class='font-mono'>{engineState.error?.message || '(none)'}</div>

              <div class='text-gray-500'>lastGlobalError</div>
              <div class='font-mono'>{lastGlobalError() || '(none)'}</div>
            </div>

            <div class='mt-2 grid grid-cols-2 gap-x-3 gap-y-1'>
              <div class='text-gray-500'>doc probe</div>
              <div class='font-mono'>
                {docFetchProbe().state === 'done' ?
                  `${docFetchProbe().result?.status ?? 'n/a'} ${docFetchProbe().result?.ok ? 'ok' : 'bad'} ${docFetchProbe().result?.error ? `(${docFetchProbe().result.error})` : ''}`
                : docFetchProbe().state}
              </div>

              <div class='text-gray-500'>wasm probe</div>
              <div class='font-mono'>
                {wasmFetchProbe().state === 'done' ?
                  `${wasmFetchProbe().result?.status ?? 'n/a'} ${wasmFetchProbe().result?.ok ? 'ok' : 'bad'} ${wasmFetchProbe().result?.error ? `(${wasmFetchProbe().result.error})` : ''}`
                : wasmFetchProbe().state}
              </div>
            </div>
          </div>
        </div>
      )}

      <Switch>
        <Match when={viewState() === 'loading'}>
          <div class='flex flex-1 items-center justify-center'>
            <div class='flex items-center gap-3 text-gray-500'>
              <div class='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />
              Loading PDF Engine...
            </div>
          </div>
        </Match>

        <Match when={viewState() === 'error'}>
          <div class='flex flex-1 items-center justify-center'>
            <div class='text-center'>
              <p class='mb-2 text-red-600'>Failed to load PDF engine</p>
              <p class='text-sm text-gray-500'>{engineState.error?.message}</p>
            </div>
          </div>
        </Match>

        <Match when={viewState() === 'no-pdf'}>
          <div class='flex flex-1 items-center justify-center'>
            <div class='text-center text-gray-500'>
              <p>No PDF selected</p>
            </div>
          </div>
        </Match>

        <Match when={viewState() === 'ready' && !canRenderEmbedPDF()}>
          <div class='flex flex-1 items-center justify-center'>
            <div class='flex items-center gap-3 text-gray-500'>
              <div class='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />
              Preparing PDF viewer...
            </div>
          </div>
        </Match>

        <Match when={viewState() === 'ready' && canRenderEmbedPDF()}>
          <EmbedPDF
            engine={engineState.engine}
            plugins={plugins()}
            logger={logger()}
            autoMountDomElements={noAutoMount() ? false : undefined}
          >
            {state => (
              <Switch>
                <Match when={!state.activeDocumentId}>
                  <div class='flex flex-1 items-center justify-center'>
                    <div class='flex items-center gap-3 text-gray-500'>
                      <div class='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />
                      Initializing PDF document...
                    </div>
                  </div>
                </Match>

                <Match when={state.activeDocumentId}>
                  <div class='relative flex flex-1'>
                    {debugEnabled() && (
                      <div class='absolute top-2 right-2 z-10 max-w-[420px]'>
                        <EmbedPdfInternalDebug
                          documentId={state.activeDocumentId}
                          documentState={state.activeDocument}
                          embedState={state}
                        />
                      </div>
                    )}

                    <Switch>
                      <Match
                        when={!state.activeDocument || state.activeDocument.status === 'loading'}
                      >
                        <div class='flex flex-1 items-center justify-center'>
                          <div class='flex items-center gap-3 text-gray-500'>
                            <div class='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />
                            Loading PDF document...
                          </div>
                        </div>
                      </Match>

                      <Match when={state.activeDocument?.status === 'error'}>
                        <div class='flex flex-1 items-center justify-center'>
                          <div class='text-center'>
                            <p class='mb-2 text-red-600'>Failed to load PDF document</p>
                            <p class='text-sm text-gray-500'>
                              {state.activeDocument?.error?.message ||
                                state.activeDocument?.error ||
                                'Unknown error occurred'}
                            </p>
                          </div>
                        </div>
                      </Match>

                      <Match when={state.activeDocument?.status === 'loaded'}>
                        <viewport.Viewport documentId={state.activeDocumentId} class='flex-1'>
                          <scroll.Scroller
                            documentId={state.activeDocumentId}
                            renderPage={pageLayout => (
                              <div
                                class='bg-white shadow-sm ring-1 ring-gray-200'
                                style={{
                                  width: `${pageLayout.rotatedWidth}px`,
                                  height: `${pageLayout.rotatedHeight}px`,
                                }}
                              >
                                <render.RenderLayer
                                  documentId={state.activeDocumentId}
                                  pageIndex={pageLayout.pageIndex}
                                />
                              </div>
                            )}
                          />
                        </viewport.Viewport>
                      </Match>
                    </Switch>
                  </div>
                </Match>
              </Switch>
            )}
          </EmbedPDF>
        </Match>
      </Switch>
    </div>
  );
}
