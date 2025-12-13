/**
 * ChecklistWithPdf - Wrapper that combines AMSTAR2Checklist with a PDF viewer
 * in a split-screen layout. Used by both local and project checklists.
 */

import AMSTAR2Checklist from '@checklist-ui/AMSTAR2Checklist.jsx';
import PdfViewer from '@/components/checklist-ui/pdf/PdfViewer.jsx';
import SplitScreenLayout from '@checklist-ui/SplitScreenLayout.jsx';

export default function ChecklistWithPdf(props) {
  // props.checklist - the checklist data
  // props.onUpdate - callback for checklist updates
  // props.headerContent - optional content to show in the header bar (left side)
  // props.pdfData - saved PDF ArrayBuffer (optional)
  // props.pdfFileName - saved PDF file name (optional)
  // props.onPdfChange - callback when PDF changes: (data, fileName) => void
  // props.onPdfClear - callback when PDF is cleared
  // props.readOnly - if true, disables checklist updates and PDF uploads

  return (
    <div class='h-full flex flex-col bg-blue-50'>
      {/* Split screen with checklist and PDF */}
      <SplitScreenLayout
        defaultLayout='vertical'
        defaultRatio={50}
        showSecondPanel={false}
        headerContent={props.headerContent}
      >
        {/* First panel: Checklist */}
        <AMSTAR2Checklist
          externalChecklist={props.checklist}
          onExternalUpdate={props.onUpdate}
          readOnly={props.readOnly}
        />

        {/* Second panel: PDF Viewer */}
        <PdfViewer
          pdfData={props.pdfData}
          pdfFileName={props.pdfFileName}
          onPdfChange={props.onPdfChange}
          onPdfClear={props.onPdfClear}
          readOnly={props.readOnly}
        />
      </SplitScreenLayout>
    </div>
  );
}
