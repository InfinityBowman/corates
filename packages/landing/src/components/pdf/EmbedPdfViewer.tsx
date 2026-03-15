/**
 * EmbedPdfViewer - Stub for the Preact-based PDF viewer
 * TODO(agent): Migrate the actual Preact PDF viewer component.
 * The real implementation uses @embedpdf packages with a Preact island.
 */

export interface EmbedPdfViewerProps {
  pdfData?: ArrayBuffer | null;
  pdfFileName?: string;
  readOnly?: boolean;
  pdfs?: any[];
  selectedPdfId?: string | null;
  onPdfSelect?: (_pdfId: string) => void;
  onAnnotationAdd?: (..._args: any[]) => void;
  onAnnotationUpdate?: (..._args: any[]) => void;
  onAnnotationDelete?: (..._args: any[]) => void;
  initialAnnotations?: any[];
  onPdfChange?: (..._args: any[]) => void;
  onPdfClear?: () => void;
  allowDelete?: boolean;
}

export default function EmbedPdfViewer({ pdfFileName }: EmbedPdfViewerProps) {
  return (
    <div className='bg-secondary flex h-full flex-col items-center justify-center p-8'>
      <p className='text-foreground font-medium'>PDF Viewer</p>
      <p className='text-muted-foreground mt-1 text-sm'>{pdfFileName || 'No file selected'}</p>
      <p className='text-muted-foreground mt-4 text-xs'>
        PDF viewer will be available after full migration
      </p>
    </div>
  );
}
