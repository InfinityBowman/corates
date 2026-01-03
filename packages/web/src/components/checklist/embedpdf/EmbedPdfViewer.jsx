/**
 * EmbedPdfViewer - Component for viewing PDF files
 * Supports two modes via VITE_PDF_VIEWER_MODE:
 * - 'pdfjs': PDF.js with custom UI (default)
 * - 'snippet': EmbedPDF snippet viewer with full UI
 */

import { Switch, Match } from 'solid-js';
import { PDF_VIEWER_MODE } from '@config/pdfViewer';
import EmbedPdfViewerSnippet from './EmbedPdfViewerSnippet';
import EmbedPdfViewerPdfJs from './EmbedPdfViewerPdfJs';

/**
 * EmbedPdfViewer - Component for viewing PDF files using EmbedPDF snippet viewer
 * @param {Object} props - Component props
 * @param {ArrayBuffer} props.pdfData - ArrayBuffer of PDF data (required)
 * @param {string} props.pdfFileName - Name of the PDF file (optional, for display)
 * @param {boolean} props.readOnly - If true, view only mode
 *
 * @returns
 */
export default function EmbedPdfViewer(props) {
  return (
    <Switch>
      <Match when={PDF_VIEWER_MODE === 'snippet'}>
        <EmbedPdfViewerSnippet
          pdfData={props.pdfData}
          pdfFileName={props.pdfFileName}
          readOnly={props.readOnly}
        />
      </Match>

      <Match when={PDF_VIEWER_MODE === 'pdfjs'}>
        <EmbedPdfViewerPdfJs pdfData={props.pdfData} pdfFileName={props.pdfFileName} />
      </Match>
    </Switch>
  );
}
