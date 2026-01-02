/**
 * ChecklistWithPdf - Wrapper that combines any checklist type with a PDF viewer
 * in a split-screen layout. Used by both local and project checklists.
 *
 * Supports multiple checklist types via the GenericChecklist component.
 */

import GenericChecklist from '@/components/checklist/GenericChecklist.jsx';
import PdfViewer from '@/components/checklist/pdf/PdfViewer.jsx';
import SplitScreenLayout from '@/components/checklist/SplitScreenLayout.jsx';

export default function ChecklistWithPdf(props) {
  // props.checklistType - the type of checklist ('AMSTAR2', 'ROBINS_I', etc.)
  // props.checklist - the checklist data
  // props.onUpdate - callback for checklist updates
  // props.headerContent - optional content to show in the header bar (left side)
  // props.pdfData - saved PDF ArrayBuffer (optional)
  // props.pdfFileName - saved PDF file name (optional)
  // props.onPdfChange - callback when PDF changes: (data, fileName) => void
  // props.onPdfClear - callback when PDF is cleared
  // props.readOnly - if true, disables checklist updates and PDF uploads
  // props.allowDelete - if true, shows PDF delete button (only applies when !readOnly)
  // props.pdfs - array of PDFs for multi-PDF selection
  // props.selectedPdfId - currently selected PDF ID
  // props.onPdfSelect - handler for PDF selection change
  // props.getQuestionNote - function to get Y.Text for a question note
  // props.getRobinsText - function to get Y.Text for a ROBINS-I free-text field
  // props.pdfUrl - optional PDF URL (for server-hosted PDFs)

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
        />

        {/* Second panel: PDF Viewer */}
        <PdfViewer
          pdfData={props.pdfData}
          pdfFileName={props.pdfFileName}
          onPdfChange={props.onPdfChange}
          onPdfClear={props.onPdfClear}
          readOnly={props.readOnly}
          allowDelete={props.allowDelete}
          pdfs={props.pdfs}
          selectedPdfId={props.selectedPdfId}
          onPdfSelect={props.onPdfSelect}
        />
      </SplitScreenLayout>
    </div>
  );
}
