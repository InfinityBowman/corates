/**
 * ChecklistWithPdf - Wrapper that combines any checklist type with a PDF viewer
 * in a split-screen layout. Used by both local and project checklists.
 *
 * Supports multiple checklist types via the GenericChecklist component.
 */

import { lazy, Suspense } from 'react';
import type * as Y from 'yjs';
import { GenericChecklist } from '@/components/checklist/GenericChecklist';
import { SplitScreenLayout } from '@/components/checklist/SplitScreenLayout';
import type { TextRef } from '@/primitives/useProject/checklists';

const EmbedPdfViewer = lazy(() => import('@/components/pdf/EmbedPdfViewer'));

interface ChecklistWithPdfProps {
  checklistType?: string;
  checklist: any;
  onUpdate: (_patch: Record<string, any>) => void;
  headerContent?: React.ReactNode;
  pdfData?: ArrayBuffer | null;
  pdfFileName?: string | null;
  readOnly?: boolean;
  pdfs?: any[];
  selectedPdfId?: string | null;
  onPdfSelect?: (_pdfId: string) => void;
  getTextRef: (_ref: TextRef) => Y.Text | null;
  pdfUrl?: string | null;
  onAnnotationAdd?: (_annotation: any) => void;
  onAnnotationUpdate?: (_annotation: any) => void;
  onAnnotationDelete?: (_annotationId: string) => void;
  initialAnnotations?: any[];
  onPdfChange?: (_data: ArrayBuffer, _fileName: string) => void;
  onPdfClear?: () => void;
  allowDelete?: boolean;
}

export function ChecklistWithPdf({
  checklistType,
  checklist,
  onUpdate,
  headerContent,
  pdfData,
  pdfFileName,
  readOnly,
  pdfs,
  selectedPdfId,
  onPdfSelect,
  getTextRef,
  pdfUrl,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  initialAnnotations,
  onPdfChange,
  onPdfClear,
  allowDelete,
}: ChecklistWithPdfProps) {
  return (
    <div className='flex h-full flex-col bg-blue-50'>
      <SplitScreenLayout
        defaultLayout='vertical'
        defaultRatio={50}
        showSecondPanel={!!pdfData}
        headerContent={headerContent}
        pdfUrl={pdfUrl}
        pdfData={pdfData}
      >
        {/* First panel: Checklist */}
        <GenericChecklist
          checklistType={checklistType}
          checklist={checklist}
          onUpdate={onUpdate}
          readOnly={readOnly}
          getTextRef={getTextRef}
        />

        {/* Second panel: PDF Viewer */}
        {pdfData ?
          <Suspense
            fallback={
              <div className='flex h-full items-center justify-center'>
                <div className='size-6 animate-spin rounded-full border-b-2 border-blue-600' />
              </div>
            }
          >
            <EmbedPdfViewer
              pdfData={pdfData}
              pdfFileName={pdfFileName || undefined}
              readOnly={readOnly}
              pdfs={pdfs}
              selectedPdfId={selectedPdfId}
              onPdfSelect={onPdfSelect}
              onAnnotationAdd={onAnnotationAdd}
              onAnnotationUpdate={onAnnotationUpdate}
              onAnnotationDelete={onAnnotationDelete}
              initialAnnotations={initialAnnotations}
              onPdfChange={onPdfChange}
              onPdfClear={onPdfClear}
              allowDelete={allowDelete}
            />
          </Suspense>
        : null}
      </SplitScreenLayout>
    </div>
  );
}
