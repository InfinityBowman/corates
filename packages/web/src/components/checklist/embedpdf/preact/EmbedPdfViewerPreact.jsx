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
import { useEffect, useMemo, useRef } from 'preact/hooks';

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
  // Initialize the PDF engine
  const pdfEngine = usePdfiumEngine();

  // Keep plugins stable - don't recreate on prop changes
  const plugins = useMemo(
    () => [
      createPluginRegistration(DocumentManagerPluginPackage),
      createPluginRegistration(ViewportPluginPackage),
      createPluginRegistration(ScrollPluginPackage),
      createPluginRegistration(RenderPluginPackage),
    ],
    [], // Empty deps - plugins never change
  );

  // Track loaded document ID and registry
  const loadedDocumentIdRef = useRef(null);
  const loadingRef = useRef(false);
  const registryRef = useRef(null);

  // Function to load document
  const loadDocument = (registry, pdfData, pdfFileName, documentId) => {
    if (!registry || !pdfData || loadingRef.current) return;

    const documentManager = registry
      ?.getPlugin(DocumentManagerPlugin.id)
      ?.provides();

    if (!documentManager) return;

    // Check if we've already loaded this document
    const currentDocId = loadedDocumentIdRef.current;
    if (currentDocId && documentManager.getDocument(currentDocId)) {
      // Document already loaded, just activate it
      documentManager.setActiveDocument(currentDocId);
      return;
    }

    // Load new document
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
        (result) => {
          loadedDocumentIdRef.current = result.documentId;
          loadingRef.current = false;
        },
        (error) => {
          console.error('Failed to load document:', error);
          loadingRef.current = false;
        },
      );
  };

  // Load document when props change
  useEffect(() => {
    if (registryRef.current && props.pdfData) {
      loadDocument(
        registryRef.current,
        props.pdfData,
        props.pdfFileName,
        props.selectedPdfId,
      );
    }
  }, [props.pdfData, props.pdfFileName, props.selectedPdfId]);

  // Loading state
  if (pdfEngine.isLoading || !pdfEngine.engine) {
    return (
      <div class='flex h-full items-center justify-center bg-gray-100'>
        <div class='flex items-center gap-2 text-gray-500'>
          <div class='h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600' />
          <span class='text-sm'>Loading PDF Engine...</span>
        </div>
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
    <div class='h-full w-full bg-gray-100'>
      <EmbedPDF
        engine={pdfEngine.engine}
        plugins={plugins}
        onInitialized={(registry) => {
          registryRef.current = registry;
          // Load document if pdfData is already available
          if (props.pdfData) {
            loadDocument(registry, props.pdfData, props.pdfFileName, props.selectedPdfId);
          }
        }}
      >
        {({ pluginsReady, activeDocumentId }) => {
          if (!pluginsReady) {
            return (
              <div class='flex h-full items-center justify-center'>
                <div class='flex items-center gap-2 text-gray-500'>
                  <div class='h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600' />
                  <span class='text-sm'>Initializing plugins...</span>
                </div>
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
                      <div class='flex items-center gap-2 text-gray-500'>
                        <div class='h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600' />
                        <span class='text-sm'>Loading document...</span>
                      </div>
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
                  <Viewport documentId={activeDocumentId} class='h-full bg-gray-200'>
                    <Scroller
                      documentId={activeDocumentId}
                      renderPage={({ pageIndex }) => (
                        <div
                          style={{
                            position: 'relative',
                            backgroundColor: '#fff',
                          }}
                        >
                          <RenderLayer
                            documentId={activeDocumentId}
                            pageIndex={pageIndex}
                            scale={1}
                            style={{ pointerEvents: 'none' }}
                          />
                        </div>
                      )}
                    />
                  </Viewport>
                );
              }}
            </DocumentContent>
          );
        }}
      </EmbedPDF>
    </div>
  );
}
