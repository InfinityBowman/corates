/**
 * ChecklistWithPdf - Wrapper that combines any checklist type with a PDF viewer
 * in a split-screen layout. Used by both local and project checklists.
 *
 * Supports multiple checklist types via the GenericChecklist component.
 */

import GenericChecklist from '@/components/checklist/GenericChecklist.jsx';
import SplitScreenLayout from '@/components/checklist/SplitScreenLayout.jsx';
import { Show, lazy, Suspense } from 'solid-js';

const EmbedPdfViewer = lazy(() => import('@pdf/embedpdf/EmbedPdfViewer.jsx'));

export default function ChecklistWithPdf(props) {
  // props.checklistType - the type of checklist ('AMSTAR2', 'ROBINS_I', etc.)
  // props.checklist - the checklist data
  // props.onUpdate - callback for checklist updates
  // props.headerContent - optional content to show in the header bar (left side)
  // props.pdfData - saved PDF ArrayBuffer (optional)
  // props.pdfFileName - saved PDF file name (optional)
  // props.readOnly - if true, disables checklist updates and PDF uploads
  // props.pdfs - array of PDFs for multi-PDF selection
  // props.selectedPdfId - currently selected PDF ID
  // props.onPdfSelect - handler for PDF selection change
  // props.getQuestionNote - function to get Y.Text for a question note
  // props.getRobinsText - function to get Y.Text for a ROBINS-I free-text field
  // props.getRob2Text - function to get Y.Text for a ROB-2 free-text field
  // props.pdfUrl - optional PDF URL (for server-hosted PDFs)
  // Annotation persistence props:
  // props.onAnnotationAdd - callback when annotation is created
  // props.onAnnotationUpdate - callback when annotation is updated
  // props.onAnnotationDelete - callback when annotation is deleted
  // props.initialAnnotations - array of annotations to load

  return (
    <div class='flex h-full flex-col bg-blue-50'>
      {/* Split screen with checklist and PDF */}
      <SplitScreenLayout
        defaultLayout='vertical'
        defaultRatio={50}
        showSecondPanel={false}
        headerContent={props.headerContent}
        pdfUrl={props.pdfUrl}
        pdfData={props.pdfData}
      >
        {/* First panel: Checklist (type-aware) */}
        <GenericChecklist
          checklistType={props.checklistType}
          checklist={props.checklist}
          onUpdate={props.onUpdate}
          readOnly={props.readOnly}
          getQuestionNote={props.getQuestionNote}
          getRobinsText={props.getRobinsText}
          getRob2Text={props.getRob2Text}
        />

        {/* Second panel: PDF Viewer */}
        <Show when={props.pdfData}>
          <Suspense
            fallback={
              <div class='flex h-full items-center justify-center'>
                <div class='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />
              </div>
            }
          >
            <EmbedPdfViewer
              pdfData={props.pdfData}
              pdfFileName={props.pdfFileName}
              readOnly={props.readOnly}
              pdfs={props.pdfs}
              selectedPdfId={props.selectedPdfId}
              onPdfSelect={props.onPdfSelect}
              onAnnotationAdd={props.onAnnotationAdd}
              onAnnotationUpdate={props.onAnnotationUpdate}
              onAnnotationDelete={props.onAnnotationDelete}
              initialAnnotations={props.initialAnnotations}
            />
          </Suspense>
        </Show>
      </SplitScreenLayout>
    </div>
  );
}
