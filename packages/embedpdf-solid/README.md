# @corates/embedpdf-solid

SolidJS bindings for EmbedPDF. This package provides SolidJS components and hooks that mirror the React headless API for EmbedPDF.

## Usage

```tsx
import { EmbedPDF } from '@corates/embedpdf-solid';
import { createPdfiumEngine } from '@corates/embedpdf-solid/engines';
import { Viewport, Scroller, DocumentContent, RenderLayer } from '@corates/embedpdf-solid/plugins';
import { createPluginRegistration } from '@embedpdf/core';
import { DocumentManagerPluginPackage } from '@embedpdf/plugin-document-manager';
import { ViewportPluginPackage } from '@embedpdf/plugin-viewport';
import { ScrollPluginPackage } from '@embedpdf/plugin-scroll';
import { RenderPluginPackage } from '@embedpdf/plugin-render';

function PDFViewer({ pdfUrl }: { pdfUrl: string }) {
  const { engine, isLoading } = createPdfiumEngine();

  if (isLoading() || !engine()) {
    return <div>Loading PDF Engine...</div>;
  }

  const plugins = [
    createPluginRegistration(DocumentManagerPluginPackage, {
      initialDocuments: [{ url: pdfUrl }],
    }),
    createPluginRegistration(ViewportPluginPackage),
    createPluginRegistration(ScrollPluginPackage),
    createPluginRegistration(RenderPluginPackage),
  ];

  return (
    <EmbedPDF engine={engine()!} plugins={plugins}>
      {({ activeDocumentId }) =>
        activeDocumentId && (
          <DocumentContent documentId={activeDocumentId}>
            {({ isLoaded }) =>
              isLoaded && (
                <Viewport documentId={activeDocumentId}>
                  <Scroller
                    documentId={activeDocumentId}
                    renderPage={({ width, height, pageIndex }) => (
                      <div style={{ width, height }}>
                        <RenderLayer
                          documentId={activeDocumentId}
                          pageIndex={pageIndex}
                        />
                      </div>
                    )}
                  />
                </Viewport>
              )
            }
          </DocumentContent>
        )
      }
    </EmbedPDF>
  );
}
```
